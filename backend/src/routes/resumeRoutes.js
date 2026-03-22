const fs = require('fs');
const path = require('path');

const express = require('express');
const multer = require('multer');
const { param } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { uploadResume, getResume, deleteResume } = require('../controllers/resumeController');

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    return cb(null, true);
  }
});

// Apply auth per-route (same pattern as questionRoutes) to avoid conflicts with multer
router.post('/upload', clerkAuthMiddleware(), upload.single('file'), uploadResume);
router.get('/', clerkAuthMiddleware(), getResume);
router.delete(
  '/:id',
  clerkAuthMiddleware(),
  [param('id').isMongoId().withMessage('Invalid id')],
  validateRequest,
  deleteResume
);

module.exports = router;
