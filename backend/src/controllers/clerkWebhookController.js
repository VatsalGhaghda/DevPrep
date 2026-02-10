const { Webhook } = require('svix');

const User = require('../models/User');

function getPrimaryEmail(data) {
  const emails = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const primaryId = data.primary_email_address_id;
  const primary = emails.find((e) => e.id === primaryId) || emails[0];

  if (primary && primary.email_address) {
    const email = String(primary.email_address).toLowerCase();
    if ((email.includes('@clerk.local') || email.includes('@clerk.dev')) && data.username && data.username.includes('@')) {
      return data.username.toLowerCase();
    }
    return email;
  }

  return '';
}

function isPrimaryEmailVerified(data) {
  const emails = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const primaryId = data.primary_email_address_id;
  const primary = emails.find((e) => e.id === primaryId) || emails[0];
  const status = primary && primary.verification ? primary.verification.status : '';
  return status === 'verified';
}

function getName(data) {
  const first = data.first_name ? String(data.first_name).trim() : '';
  const last = data.last_name ? String(data.last_name).trim() : '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (data.username) return String(data.username);
  const email = getPrimaryEmail(data);
  if (email) return email.split('@')[0];
  return 'User';
}

async function upsertUserFromClerk(data) {
  const clerkUserId = data.id;
  let email = getPrimaryEmail(data);
  const name = getName(data);
  const verified = isPrimaryEmailVerified(data);
  const avatar = data.image_url || '';

  // If email is empty, create a fallback email
  if (!email) {
    email = `${clerkUserId}@clerk.local`;
  }

  let user = await User.findOne({ clerkUserId });

  if (!user) {
    // Try to find by email for account linking
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

  // Update existing user
  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  user.isEmailVerified = verified || user.isEmailVerified;

  await user.save();
  return user;
}

async function clerkWebhook(req, res, next) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'CLERK_WEBHOOK_SECRET is not set' });
    }

    const svixId = req.header('svix-id');
    const svixTimestamp = req.header('svix-timestamp');
    const svixSignature = req.header('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(400).json({ message: 'Missing Svix headers' });
    }

    const payload = req.body;
    const body = Buffer.isBuffer(payload) ? payload.toString('utf8') : JSON.stringify(payload);

    const wh = new Webhook(secret);
    const evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    });

    const { type, data } = evt;

    if (type === 'user.created' || type === 'user.updated') {
      await upsertUserFromClerk(data);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { clerkWebhook };
