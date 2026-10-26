const express = require('express');
const { body, param, query } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { VIOLATION_TYPES } = require('../utils/assessmentSecurity');
const {
  listProblems,
  getProblem,
  submitSolution,
  runCode,
  saveDraft,
  getUserStatus,
  startAttempt,
  logAttemptViolation
} = require('../controllers/codingController');

const router = express.Router();

const clerkAuth = clerkAuthMiddleware();

router.get(
  '/problems',
  clerkAuth,
  [
    query('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
    query('category').optional().isString().withMessage('Invalid category'),
    query('tags').optional().isString().withMessage('Invalid tags'),
    query('q').optional().isString().withMessage('Invalid query'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Invalid limit'),
    query('sort').optional().isIn(['recent', 'difficulty', 'popularity']).withMessage('Invalid sort')
  ],
  validateRequest,
  listProblems
);

router.get(
  '/problems/:id',
  clerkAuth,
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  getProblem
);

router.post(
  '/problems/:id/submit',
  clerkAuth,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('language').optional().isString().withMessage('Language must be a string'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('attemptId').isMongoId().withMessage('A valid attemptId is required')
  ],
  validateRequest,
  submitSolution
);

router.post(
  '/problems/:id/run',
  clerkAuth,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('language').optional().isString().withMessage('Language must be a string'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('customInput').optional().isString().withMessage('Input must be a string'),
    body('attemptId').isMongoId().withMessage('A valid attemptId is required')
  ],
  validateRequest,
  runCode
);

router.post(
  '/problems/:id/attempts',
  clerkAuth,
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  startAttempt
);

router.post(
  '/attempts/:attemptId/violations',
  clerkAuth,
  [
    param('attemptId').isMongoId().withMessage('Invalid attempt id'),
    body('type').isIn(VIOLATION_TYPES).withMessage('Invalid violation type'),
    body('details').optional().isString().isLength({ max: 200 }).withMessage('details must be a short string')
  ],
  validateRequest,
  logAttemptViolation
);

router.post(
  '/problems/:id/save-draft',
  clerkAuth,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('language').optional().isString().withMessage('Language must be a string'),
    body('code').trim().notEmpty().withMessage('Code is required')
  ],
  validateRequest,
  saveDraft
);

router.get(
  '/problems/:id/status',
  clerkAuth,
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  getUserStatus
);

module.exports = router;
