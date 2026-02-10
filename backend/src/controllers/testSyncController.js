const { upsertUserFromClerk } = require('./clerkWebhookController');

async function testSyncUser(req, res, next) {
  try {
    // Get user data from request body (sent from frontend)
    const userData = req.body;
    
    if (!userData || !userData.id) {
      return res.status(400).json({ message: 'User data required' });
    }

    // Call the same upsert function that webhook uses
    const result = await upsertUserFromClerk(userData);
    
    res.status(200).json({ 
      message: 'User synced successfully',
      user: {
        id: result.clerkUserId,
        email: result.email,
        name: result.name,
        isEmailVerified: result.isEmailVerified
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { testSyncUser };
