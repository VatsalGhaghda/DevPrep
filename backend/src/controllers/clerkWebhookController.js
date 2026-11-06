const { Webhook } = require('svix');

const User = require('../models/User');
const Submission = require('../models/Submission');
const CodingAttempt = require('../models/CodingAttempt');
const MockInterviewSession = require('../models/MockInterviewSession');
const QuizAttempt = require('../models/QuizAttempt');
const SavedQuestion = require('../models/SavedQuestion');
const Resume = require('../models/Resume');
const { upsertUserFromClerk } = require('./clerkSyncController');

/** Remove a user and everything they own when they delete their Clerk account. */
async function deleteUserData(clerkUserId) {
  const user = await User.findOne({ clerkUserId });
  if (!user) return;
  const userId = user._id;
  await Promise.all([
    Submission.deleteMany({ $or: [{ userId }, { clerkUserId }] }),
    CodingAttempt.deleteMany({ userId }),
    MockInterviewSession.deleteMany({ userId }),
    QuizAttempt.deleteMany({ userId }),
    SavedQuestion.deleteMany({ userId }),
    Resume.deleteMany({ userId })
  ]);
  await user.deleteOne();
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

    let evt;
    try {
      evt = new Webhook(secret).verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature
      });
    } catch (_) {
      // Bad signature is the caller's fault: 400 so Svix doesn't keep retrying
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const { type, data } = evt;

    if (type === 'user.created' || type === 'user.updated') {
      await upsertUserFromClerk(data);
    } else if (type === 'user.deleted' && data && data.id) {
      await deleteUserData(data.id);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { clerkWebhook };
