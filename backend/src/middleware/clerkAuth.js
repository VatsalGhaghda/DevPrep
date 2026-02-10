const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

function clerkAuthMiddleware() {
  return ClerkExpressRequireAuth({});
}

module.exports = { clerkAuthMiddleware };
