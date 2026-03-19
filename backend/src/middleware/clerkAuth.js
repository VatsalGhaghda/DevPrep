const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

function clerkAuthMiddleware() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not set');
  }
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error('CLERK_PUBLISHABLE_KEY is not set');
  }
  return ClerkExpressRequireAuth({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY
  });
}

module.exports = { clerkAuthMiddleware };
