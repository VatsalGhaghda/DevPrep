const express = require('express');
const { body } = require('express-validator');

const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { generateQuestions } = require('../controllers/questionController');

const router = express.Router();

router.post(
  '/generate',
  protect,
  [
    body('role').optional().isString().withMessage('Role must be a string'),
    body('difficulty').optional().isString().withMessage('Difficulty must be a string'),
    body('topics').optional().isArray().withMessage('Topics must be an array'),
    body('count').optional().isInt({ min: 1, max: 20 }).withMessage('Count must be 1-20')
  ],
  validateRequest,
  generateQuestions
);

module.exports = router;
