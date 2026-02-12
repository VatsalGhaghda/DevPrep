const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

function clerkAuthMiddleware() {
  return ClerkExpressRequireAuth({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY
  });
}

module.exports = { clerkAuthMiddleware };
