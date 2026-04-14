/**
 * Middleware: resolves the Clerk session user to the MongoDB User document.
 * Must be used AFTER clerkAuthMiddleware() so that req.auth is populated.
 * Sets req.user to the MongoDB user document.
 */
const User = require('../models/User');
const { getClerkUserIdFromAuth } = require('../controllers/clerkSyncController');

async function resolveClerkUser(req, res, next) {
  try {
    const clerkUserId = getClerkUserIdFromAuth(req);
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Not authorized — no Clerk user ID' });
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: 'User not found in database. Please sync your profile first.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveClerkUser };
