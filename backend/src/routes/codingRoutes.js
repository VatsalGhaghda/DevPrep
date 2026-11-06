const express = require('express');
const { body, param, query } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { VIOLATION_TYPES } = require('../utils/assessmentSecurity');
const { executionLimiter } = require('../middleware/executionLimiter');
const { codeExecutionLimiter } = require('../middleware/rateLimiters');
const { SUPPORTED_LANGUAGES } = require('../utils/judgeService');
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

const MAX_CODE_LENGTH = 64 * 1024; // characters
const MAX_INPUT_LENGTH = 256 * 1024;

const codeRules = [
  body('language').optional().isIn(SUPPORTED_LANGUAGES).withMessage('Unsupported language'),
  body('code').trim().notEmpty().withMessage('Code is required')
    .isLength({ max: MAX_CODE_LENGTH }).withMessage(`Code must be at most ${MAX_CODE_LENGTH} characters`)
];

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
    ...codeRules,
    body('attemptId').isMongoId().withMessage('A valid attemptId is required')
  ],
  validateRequest,
  codeExecutionLimiter,
  executionLimiter,
  submitSolution
);

router.post(
  '/problems/:id/run',
  clerkAuth,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    ...codeRules,
    body('customInput').optional().isString().isLength({ max: MAX_INPUT_LENGTH }).withMessage('Input is too large'),
    body('attemptId').isMongoId().withMessage('A valid attemptId is required')
  ],
  validateRequest,
  codeExecutionLimiter,
  executionLimiter,
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
    ...codeRules
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
module.exports.MAX_CODE_LENGTH = MAX_CODE_LENGTH;
module.exports.MAX_INPUT_LENGTH = MAX_INPUT_LENGTH;
