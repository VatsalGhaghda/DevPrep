const express = require('express');

const { clerkWebhook } = require('../controllers/clerkWebhookController');

const router = express.Router();

// Clerk (Svix) requires raw body for signature verification
router.post('/clerk', express.raw({ type: 'application/json' }), clerkWebhook);

module.exports = router;
