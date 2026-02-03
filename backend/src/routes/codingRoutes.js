const express = require('express');
const { body, param, query } = require('express-validator');

const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  listProblems,
  getProblem,
  submitSolution,
  runCode
} = require('../controllers/codingController');

const router = express.Router();

router.get(
  '/problems',
  protect,
  [
    query('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
    query('category').optional().isString().withMessage('Invalid category'),
    query('q').optional().isString().withMessage('Invalid query')
  ],
  validateRequest,
  listProblems
);

router.get(
  '/problems/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  getProblem
);

router.post(
  '/problems/:id/submit',
  protect,
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
  protect,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('language').optional().isString().withMessage('Language must be a string'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('input').optional().isString().withMessage('Input must be a string')
  ],
  validateRequest,
  runCode
);

module.exports = router;
