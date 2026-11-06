const express = require('express');
const multer = require('multer');
const { body, param } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  mockInterviewStartLimiter,
  mockInterviewMessageLimiter,
  voiceTranscriptionLimiter
} = require('../middleware/rateLimiters');
const { AppError } = require('../utils/AppError');
const { isSupportedAudio } = require('../utils/speechService');
const { transcribeAnswer } = require('../controllers/voiceController');
const { VIOLATION_TYPES } = require('../utils/assessmentSecurity');
const {
  startSession,
  beginSession,
  getSession,
  sendMessage,
  endSession,
  getHistory,
  logViolation,
  retryEvaluation
} = require('../controllers/mockInterviewController');

const router = express.Router();

// All routes require Clerk authentication
router.use(clerkAuthMiddleware());

router.post(
  '/start',
  mockInterviewStartLimiter,
  [
    body('interviewType')
      .isIn(['technical', 'hr', 'mixed', 'resume-based'])
      .withMessage('Interview type must be technical, hr, mixed, or resume-based'),
    body('role').optional().isString().trim().isLength({ max: 100 })
      .withMessage('Role must be a string (max 100 chars)'),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be easy, medium, or hard'),
    body('duration').optional().isInt().isIn([15, 30, 45, 60])
      .withMessage('Duration must be 15, 30, 45, or 60'),
    body('selectedTopics').optional().isArray({ max: 10 })
      .withMessage('Selected topics must be an array of at most 10 topics'),
    body('selectedTopics.*').optional().isString().isLength({ max: 50 })
      .withMessage('Each topic must be a string of at most 50 characters'),
    body('resumeId').optional().isMongoId()
      .withMessage('Resume ID must be a valid ID')
  ],
  validateRequest,
  startSession
);

router.get('/history', getHistory);

// The candidate finished the device check and pressed Start
router.post(
  '/:id/begin',
  mockInterviewMessageLimiter,
  [param('id').isMongoId().withMessage('Invalid session id')],
  validateRequest,
  beginSession
);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid session id')],
  validateRequest,
  getSession
);

router.post(
  '/:id/message',
  mockInterviewMessageLimiter,
  [
    param('id').isMongoId().withMessage('Invalid session id'),
    body('content').trim().notEmpty().withMessage('Message content is required')
      .isLength({ max: 20000 }).withMessage('Message too long')
  ],
  validateRequest,
  sendMessage
);

// Spoken answers (voice mode) when the browser has no speech recognition.
// Audio is kept in memory, transcribed, and discarded.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!isSupportedAudio(file.mimetype)) {
      return cb(new AppError('Unsupported audio format', 415));
    }
    return cb(null, true);
  }
});

router.post(
  '/:id/transcribe',
  voiceTranscriptionLimiter,
  [param('id').isMongoId().withMessage('Invalid session id')],
  validateRequest,
  audioUpload.single('audio'),
  transcribeAnswer
);

router.post(
  '/:id/end',
  [
    param('id').isMongoId().withMessage('Invalid session id'),
    body('status').optional().isIn(['completed', 'abandoned'])
      .withMessage('Status must be completed or abandoned')
  ],
  validateRequest,
  endSession
);

router.post(
  '/:id/violations',
  [
    param('id').isMongoId().withMessage('Invalid session id'),
    body('type').isIn(VIOLATION_TYPES).withMessage('Invalid violation type'),
    body('details').optional().isString().isLength({ max: 200 }).withMessage('details must be a short string')
  ],
  validateRequest,
  logViolation
);

router.post(
  '/:id/evaluate',
  mockInterviewStartLimiter,
  [param('id').isMongoId().withMessage('Invalid session id')],
  validateRequest,
  retryEvaluation
);

module.exports = router;
