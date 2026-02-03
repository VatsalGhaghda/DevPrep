const express = require('express');
const { body, param } = require('express-validator');

const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  createInterview,
  getInterview,
  addQuestion,
  submitAnswer,
  evaluateAnswer,
  endInterview,
  getHistory,
  getReport
} = require('../controllers/interviewController');

const router = express.Router();

router.post(
  '/create',
  protect,
  [
    body('type')
      .isIn(['mock', 'hr', 'coding', 'resume-based'])
      .withMessage('Invalid interview type'),
    body('role').optional().isString().withMessage('Role must be a string'),
    body('difficulty').optional().isString().withMessage('Difficulty must be a string'),
    body('topics').optional().isArray().withMessage('Topics must be an array')
  ],
  validateRequest,
  createInterview
);

router.get('/:id', protect, [param('id').isMongoId().withMessage('Invalid id')], validateRequest, getInterview);

router.post(
  '/:id/question',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('text').optional().isString().withMessage('Question text must be a string'),
    body('topic').optional().isString().withMessage('Topic must be a string')
  ],
  validateRequest,
  addQuestion
);

router.post(
  '/:id/answer',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('questionIndex').isInt({ min: 0 }).withMessage('questionIndex must be a number'),
    body('text').trim().notEmpty().withMessage('Answer text is required')
  ],
  validateRequest,
  submitAnswer
);

router.post(
  '/:id/evaluate',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('score').isFloat({ min: 0, max: 100 }).withMessage('Score must be 0-100'),
    body('feedback').optional().isString().withMessage('Feedback must be a string')
  ],
  validateRequest,
  evaluateAnswer
);

router.post(
  '/:id/end',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a non-negative number'),
    body('status')
      .optional()
      .isIn(['completed', 'abandoned'])
      .withMessage('Invalid status')
  ],
  validateRequest,
  endInterview
);

router.get('/history', protect, getHistory);

router.get(
  '/:id/report',
  protect,
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  getReport
);

module.exports = router;
