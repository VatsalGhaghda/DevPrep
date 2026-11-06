const { clerkClient } = require('@clerk/clerk-sdk-node');

const User = require('../models/User');

/**
 * Clerk sends users in two shapes: camelCase from the SDK (clerkClient.users.getUser)
 * and snake_case in webhooks. Normalise both into one shape.
 */
function normalizeClerkUser(data) {
  const pick = (camel, snake) => (data[camel] !== undefined ? data[camel] : data[snake]);
  const emails = (pick('emailAddresses', 'email_addresses') || []).map((e) => ({
    id: e.id,
    emailAddress: e.emailAddress || e.email_address || '',
    verified: Boolean(e.verification && e.verification.status === 'verified')
  }));
  return {
    id: data.id,
    firstName: pick('firstName', 'first_name') || '',
    lastName: pick('lastName', 'last_name') || '',
    username: data.username || '',
    imageUrl: pick('imageUrl', 'image_url') || '',
    primaryEmailId: pick('primaryEmailAddressId', 'primary_email_address_id'),
    emails
  };
}

function getPrimaryEmailEntry(u) {
  return u.emails.find((e) => e.id === u.primaryEmailId) || u.emails[0] || null;
}

function getPrimaryEmail(u) {
  const primary = getPrimaryEmailEntry(u);
  if (!primary || !primary.emailAddress) return '';
  const email = String(primary.emailAddress).toLowerCase();
  if ((email.includes('@clerk.local') || email.includes('@clerk.dev')) && u.username && u.username.includes('@')) {
    return u.username.toLowerCase();
  }
  return email;
}

function isPrimaryEmailVerified(u) {
  const primary = getPrimaryEmailEntry(u);
  return Boolean(primary && primary.verified);
}

function getName(u) {
  const full = `${String(u.firstName).trim()} ${String(u.lastName).trim()}`.trim();
  if (full.length >= 2) return full.slice(0, 100);
  if (u.username && u.username.length >= 2) return String(u.username).slice(0, 100);
  const email = getPrimaryEmail(u);
  const local = email ? email.split('@')[0] : '';
  return local.length >= 2 ? local.slice(0, 100) : 'User';
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

function slugifyUsername(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 24);
}

/** Pick a unique public username based on the Clerk username, name or email. */
async function generateUniqueUsername(u) {
  const email = getPrimaryEmail(u);
  const candidates = [u.username, `${u.firstName}${u.lastName}`, email.split('@')[0], 'user']
    .map(slugifyUsername)
    .filter((c) => c.length >= 3);
  const base = candidates[0] || 'user';

  for (let i = 0; i < 20; i++) {
    const suffix = i === 0 ? '' : String(Math.floor(1000 + Math.random() * 9000 * (i > 10 ? 10 : 1)));
    const candidate = `${base}${suffix}`.slice(0, 30);
    // eslint-disable-next-line no-await-in-loop
    if (USERNAME_RE.test(candidate) && !(await User.exists({ username: candidate }))) return candidate;
  }
  return `user${Date.now().toString(36)}`;
}

/**
 * Create or update the MongoDB user for a Clerk user.
 *
 * Profile fields the user can edit in DevPrep (name, avatar, username) are only
 * filled in from Clerk when they are empty, so a sign-in or webhook never
 * overwrites what the user chose on the Edit Profile page.
 */
async function upsertUserFromClerk(rawClerkUser) {
  const u = normalizeClerkUser(rawClerkUser);
  const clerkUserId = u.id;
  const verified = isPrimaryEmailVerified(u);
  let email = getPrimaryEmail(u) || `${clerkUserId}@clerk.local`;
  email = email.toLowerCase();

  let user = await User.findOne({ clerkUserId });

  if (!user) {
    // Only link to an existing account by email when Clerk has verified
    // that this person owns the address.
    const existing = verified ? await User.findOne({ email, clerkUserId: { $in: [null, ''] } }) : null;
    if (existing) {
      user = existing;
      user.clerkUserId = clerkUserId;
    } else {
      if (await User.exists({ email })) {
        // Address belongs to another account and could not be verified: keep them separate
        email = `${clerkUserId}@clerk.local`;
      }
      user = new User({ clerkUserId, email, name: getName(u), avatar: u.imageUrl });
    }
  }

  if (!user.name || user.name.length < 2) user.name = getName(u);

  const currentAvatar = typeof user.avatar === 'string' ? user.avatar : '';
  const isCustomAvatar = currentAvatar.startsWith('data:');
  const isHttpAvatar = /^https?:\/\//.test(currentAvatar);
  if (u.imageUrl && !isCustomAvatar && (!currentAvatar || isHttpAvatar)) {
    // Keep following Clerk's image only while the user hasn't uploaded their own
    user.avatar = u.imageUrl;
  }

  if (!user.username) user.username = await generateUniqueUsername(u);
  user.isEmailVerified = verified || user.isEmailVerified;

  await user.save();
  return user;
}

// Back-compat name used across controllers
const upsertUserFromClerkApi = upsertUserFromClerk;

function getClerkUserIdFromAuth(req) {
  if (req.auth && req.auth.userId) return req.auth.userId;
  if (req.auth && req.auth.sessionClaims && req.auth.sessionClaims.sub) return req.auth.sessionClaims.sub;
  if (req.auth && req.auth.claims && req.auth.claims.sub) return req.auth.claims.sub;
  return '';
}

function publicUserView(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username || '',
    email: user.email,
    role: user.role,
    skills: user.skills,
    targetRole: user.targetRole,
    experienceLevel: user.experienceLevel,
    bio: user.bio,
    avatar: user.avatar,
    isProfilePublic: user.isProfilePublic !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function syncMe(req, res, next) {
  try {
    const clerkUserId = getClerkUserIdFromAuth(req);

    if (!clerkUserId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const user = await upsertUserFromClerk(clerkUser);

    return res.status(200).json({ user: publicUserView(user) });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  syncMe,
  upsertUserFromClerk,
  upsertUserFromClerkApi,
  getClerkUserIdFromAuth,
  publicUserView,
  USERNAME_RE
};
