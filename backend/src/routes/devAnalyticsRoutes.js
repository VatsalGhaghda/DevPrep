const express = require('express');
const { body, param } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { devAnalyticsSyncLimiter } = require('../middleware/rateLimiters');
const { PLATFORMS } = require('../utils/devAnalytics/usernames');
const {
  getAnalytics,
  connectPlatform,
  disconnectPlatform,
  syncAnalytics,
  getContests
} = require('../controllers/devAnalyticsController');

const router = express.Router();

// Every route is for the signed-in user's own analytics
router.use(clerkAuthMiddleware());

const platformParam = param('platform').isIn(PLATFORMS).withMessage('Unknown platform');

router.get('/', getAnalytics);

router.get('/contests', getContests);

router.put(
  '/connections/:platform',
  devAnalyticsSyncLimiter,
  [platformParam, body('value').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Enter a profile URL or username')],
  validateRequest,
  connectPlatform
);

router.delete('/connections/:platform', [platformParam], validateRequest, disconnectPlatform);

router.post(
  '/sync',
  devAnalyticsSyncLimiter,
  [
    body('platform').optional().isIn(PLATFORMS).withMessage('Unknown platform'),
    body('onlyStale').optional().isBoolean()
  ],
  validateRequest,
  syncAnalytics
);

module.exports = router;
