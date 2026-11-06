const express = require('express');
const { body, param } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { questionGenerationLimiter } = require('../middleware/rateLimiters');
const { VIOLATION_TYPES } = require('../utils/assessmentSecurity');
const {
  generateQuestions,
  saveQuestions,
  getSavedStats,
  getAttempt,
  startAttempt,
  submitAttempt,
  abandonAttempt,
  retakeAttempt,
  logAttemptViolation
} = require('../controllers/questionController');

const router = express.Router();

router.post(
  '/generate',
  clerkAuthMiddleware(),
  questionGenerationLimiter,
  [
    body('role').optional().isString().isLength({ max: 100 }).withMessage('Role must be a string (max 100 chars)'),
    body('difficulty').optional().isString().isLength({ max: 20 }).withMessage('Difficulty must be a short string'),
    body('topics').optional().isArray({ max: 10 }).withMessage('Topics must be an array (max 10)'),
    body('topics.*').optional().isString().isLength({ max: 50 }).withMessage('Each topic must be at most 50 chars'),
    body('excludeQuestions.*').optional().isString().isLength({ max: 1000 }).withMessage('Excluded questions must be strings'),
    body('count').optional().isInt({ min: 1, max: 20 }).withMessage('Count must be 1-20'),
    body('excludeQuestions').optional().isArray().withMessage('excludeQuestions must be an array')
  ],
  validateRequest,
  generateQuestions
);

router.post(
  '/save',
  clerkAuthMiddleware(),
  [
    body('role').optional().isString().withMessage('Role must be a string'),
    body('difficulty').optional().isString().withMessage('Difficulty must be a string'),
    body('topics').optional().isArray().withMessage('Topics must be an array'),
    body('questions').isArray().withMessage('questions must be an array')
  ],
  validateRequest,
  saveQuestions
);

router.get('/saved/stats', clerkAuthMiddleware(), getSavedStats);

/* ── Quiz attempts ── */

const attemptId = param('id').isMongoId().withMessage('Invalid attempt id');

router.get('/attempts/:id', clerkAuthMiddleware(), [attemptId], validateRequest, getAttempt);

router.post('/attempts/:id/start', clerkAuthMiddleware(), [attemptId], validateRequest, startAttempt);

router.post(
  '/attempts/:id/submit',
  clerkAuthMiddleware(),
  [
    attemptId,
    body('answers').isArray({ max: 50 }).withMessage('answers must be an array')
  ],
  validateRequest,
  submitAttempt
);

router.post('/attempts/:id/abandon', clerkAuthMiddleware(), [attemptId], validateRequest, abandonAttempt);

router.post('/attempts/:id/retake', clerkAuthMiddleware(), [attemptId], validateRequest, retakeAttempt);

router.post(
  '/attempts/:id/violations',
  clerkAuthMiddleware(),
  [
    attemptId,
    body('type').isIn(VIOLATION_TYPES).withMessage('Invalid violation type'),
    body('details').optional().isString().isLength({ max: 200 }).withMessage('details must be a short string')
  ],
  validateRequest,
  logAttemptViolation
);

module.exports = router;
