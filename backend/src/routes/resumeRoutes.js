const express = require('express');
const multer = require('multer');
const { param } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { AppError } = require('../utils/AppError');
const { mockInterviewStartLimiter } = require('../middleware/rateLimiters');
const { uploadResume, getResume, deleteResume } = require('../controllers/resumeController');

const router = express.Router();

// Keep uploads in memory: the PDF is parsed immediately and never stored on
// disk (local disk is wiped on every Render/Railway deploy).
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new AppError('Only PDF files are allowed', 400));
    }
    return cb(null, true);
  }
});

// Apply auth per-route (same pattern as questionRoutes) to avoid conflicts with multer
// Each upload triggers an AI extraction, so it shares the interview-start limit
router.post('/upload', clerkAuthMiddleware(), mockInterviewStartLimiter, upload.single('file'), uploadResume);
router.get('/', clerkAuthMiddleware(), getResume);
router.delete(
  '/:id',
  clerkAuthMiddleware(),
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  deleteResume
);

module.exports = router;
