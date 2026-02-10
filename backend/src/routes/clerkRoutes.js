const express = require('express');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { syncMe } = require('../controllers/clerkSyncController');

const router = express.Router();

router.post('/sync/me', clerkAuthMiddleware(), syncMe);

module.exports = router;
