/**
 * /api/execute — run code without a problem (playground), plus an alias for
 * submitting to a problem. The judging logic lives in codingController so
 * both endpoints behave identically.
 */
const express = require('express');
const { body } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { executionLimiter } = require('../middleware/executionLimiter');
const { codeExecutionLimiter } = require('../middleware/rateLimiters');
const { executeCode, SUPPORTED_LANGUAGES } = require('../utils/judgeService');
const { submitSolution } = require('../controllers/codingController');
const { MAX_CODE_LENGTH, MAX_INPUT_LENGTH } = require('./codingRoutes');

const router = express.Router();
const clerkAuth = clerkAuthMiddleware();

router.post(
  '/run',
  clerkAuth,
  codeExecutionLimiter,
  [
    body('code').trim().notEmpty().withMessage('Code is required')
      .isLength({ max: MAX_CODE_LENGTH }).withMessage(`Code must be at most ${MAX_CODE_LENGTH} characters`),
    body('language').optional().isIn(SUPPORTED_LANGUAGES).withMessage('Unsupported language'),
    body('input').optional().isString().isLength({ max: MAX_INPUT_LENGTH }).withMessage('Input is too large')
  ],
  validateRequest,
  executionLimiter,
  async (req, res, next) => {
    try {
      const { code, language = 'python', input = '' } = req.body;
      const result = await executeCode(language, code, input);
      res.status(200).json({
        output: result.stdout,
        error: result.stderr || result.compileOutput || '',
        status: result.status,
        executionTime: result.time
      });
    } catch (err) {
      next(err);
    }
  }
);

// Alias of POST /api/coding/problems/:id/submit
router.post(
  '/submit',
  clerkAuth,
  codeExecutionLimiter,
  [
    body('problemId').isMongoId().withMessage('A valid problem ID is required'),
    body('code').trim().notEmpty().withMessage('Code is required')
      .isLength({ max: MAX_CODE_LENGTH }).withMessage(`Code must be at most ${MAX_CODE_LENGTH} characters`),
    body('language').optional().isIn(SUPPORTED_LANGUAGES).withMessage('Unsupported language'),
    body('attemptId').isMongoId().withMessage('A valid attemptId is required')
  ],
  validateRequest,
  executionLimiter,
  (req, res, next) => {
    req.params.id = req.body.problemId;
    return submitSolution(req, res, next);
  }
);

module.exports = router;
