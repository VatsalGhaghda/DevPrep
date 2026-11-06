const express = require('express');
const { param, query } = require('express-validator');

const { validateRequest } = require('../middleware/validateRequest');
const { publicLimiter } = require('../middleware/rateLimiters');
const { searchUsers, getPublicProfile, getPublicAnalytics } = require('../controllers/userController');

const router = express.Router();

// Profile reads/updates for signed-in users live under /api/clerk/profile.

// Public endpoints (no auth required, rate limited per IP)
const usernameParam = param('username').isString().isLength({ min: 1, max: 100 }).withMessage('Invalid username');

router.get(
  '/search',
  publicLimiter,
  [query('q').optional().isString().isLength({ max: 50 }).withMessage('Search query is too long')],
  validateRequest,
  searchUsers
);
router.get('/public/:username', publicLimiter, [usernameParam], validateRequest, getPublicProfile);
router.get('/public/:username/analytics', publicLimiter, [usernameParam], validateRequest, getPublicAnalytics);

module.exports = router;
