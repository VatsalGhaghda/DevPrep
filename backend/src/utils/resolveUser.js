/**
 * Shared helper: find the MongoDB user for the Clerk session on this request,
 * creating it from the Clerk API on first use.
 *
 * Must run after clerkAuthMiddleware(). Returns null when the request has no
 * Clerk user id.
 */
const { clerkClient } = require('@clerk/clerk-sdk-node');

const User = require('../models/User');
const { upsertUserFromClerkApi, getClerkUserIdFromAuth } = require('../controllers/clerkSyncController');

async function resolveUser(req) {
  const clerkUserId = getClerkUserIdFromAuth(req);
  if (!clerkUserId) return null;

  let user = await User.findOne({ clerkUserId });
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    user = await upsertUserFromClerkApi(clerkUser);
  }
  return user;
}

module.exports = { resolveUser };
