const express = require('express');
const { testSyncUser } = require('../controllers/testSyncController');

const router = express.Router();

// Test endpoint for syncing user to MongoDB (bypasses webhook verification)
router.post('/sync-user', testSyncUser);

module.exports = router;
