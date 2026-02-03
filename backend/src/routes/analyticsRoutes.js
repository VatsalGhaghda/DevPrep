const express = require('express');

const { protect } = require('../middleware/auth');
const {
  getOverview,
  getPerformance,
  getTopics
} = require('../controllers/analyticsController');

const router = express.Router();

router.get('/overview', protect, getOverview);
router.get('/performance', protect, getPerformance);
router.get('/topics', protect, getTopics);

module.exports = router;
