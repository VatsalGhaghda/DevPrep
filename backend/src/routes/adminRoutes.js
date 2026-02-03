const express = require('express');
const { query } = require('express-validator');

const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { validateRequest } = require('../middleware/validateRequest');
const { getUsers, getStats, getAnalytics } = require('../controllers/adminController');

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('search').optional().isString().withMessage('Invalid search')
  ],
  validateRequest,
  getUsers
);

router.get('/stats', getStats);
router.get('/analytics', getAnalytics);

module.exports = router;
