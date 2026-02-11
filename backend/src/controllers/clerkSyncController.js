const { clerkClient } = require('@clerk/clerk-sdk-node');

const User = require('../models/User');

function getPrimaryEmail(data) {
  const emails = Array.isArray(data.emailAddresses) ? data.emailAddresses : [];
  const primaryId = data.primaryEmailAddressId;
  const primary = emails.find((e) => e.id === primaryId) || emails[0];

  if (primary && primary.emailAddress) {
    const email = String(primary.emailAddress).toLowerCase();
    if ((email.includes('@clerk.local') || email.includes('@clerk.dev')) && data.username && data.username.includes('@')) {
      return data.username.toLowerCase();
    }
    return email;
  }

  return '';
}

function isPrimaryEmailVerified(data) {
  const emails = Array.isArray(data.emailAddresses) ? data.emailAddresses : [];
  const primaryId = data.primaryEmailAddressId;
  const primary = emails.find((e) => e.id === primaryId) || emails[0];
  const status = primary && primary.verification ? primary.verification.status : '';
  return status === 'verified';
}

function getName(data) {
  const first = data.firstName ? String(data.firstName).trim() : '';
  const last = data.lastName ? String(data.lastName).trim() : '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (data.username) return String(data.username);
  const email = getPrimaryEmail(data);
  if (email) return email.split('@')[0];
  return 'User';
}

async function upsertUserFromClerkApi(clerkUser) {
  const clerkUserId = clerkUser.id;
  let email = getPrimaryEmail(clerkUser);
  const name = getName(clerkUser);
  const verified = isPrimaryEmailVerified(clerkUser);
  const avatar = clerkUser.imageUrl || '';

  if (!email) {
    email = `${clerkUserId}@clerk.local`;
  }

  let user = await User.findOne({ clerkUserId });

  if (!user) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.clerkUserId = clerkUserId;
    } else {
      user = new User({
        clerkUserId,
        email,
        name,
        avatar,
        isEmailVerified: verified
      });
    }
  }

  if (name) user.name = name;

  const currentAvatar = typeof user.avatar === 'string' ? user.avatar : '';
  const isCustomAvatar = currentAvatar.startsWith('data:');
  const isHttpAvatar = currentAvatar.startsWith('http://') || currentAvatar.startsWith('https://');

  if (avatar && (!currentAvatar || (!isCustomAvatar && isHttpAvatar))) {
    user.avatar = avatar;
  }
  user.isEmailVerified = verified || user.isEmailVerified;

  await user.save();
  return user;
}

function getClerkUserIdFromAuth(req) {
  if (req.auth && req.auth.userId) return req.auth.userId;
  if (req.auth && req.auth.sessionClaims && req.auth.sessionClaims.sub) return req.auth.sessionClaims.sub;
  if (req.auth && req.auth.claims && req.auth.claims.sub) return req.auth.claims.sub;
  return '';
}

async function syncMe(req, res, next) {
  try {
    const clerkUserId = getClerkUserIdFromAuth(req);

    if (!clerkUserId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const user = await upsertUserFromClerkApi(clerkUser);

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        targetRole: user.targetRole,
        experienceLevel: user.experienceLevel,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { syncMe, upsertUserFromClerkApi, getClerkUserIdFromAuth };
