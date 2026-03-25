const express = require('express');
const { body, param, query } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  listProblems,
  getProblem,
  submitSolution,
  runCode,
  saveDraft,
  getUserStatus
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
    body('code').trim().notEmpty().withMessage('Code is required')
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
    body('customInput').optional().isString().withMessage('Input must be a string')
  ],
  validateRequest,
  runCode
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
