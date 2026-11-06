const express = require('express');
const { body } = require('express-validator');

const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const { syncMe } = require('../controllers/clerkSyncController');
const { validateRequest } = require('../middleware/validateRequest');
const { getProfile, updateProfile } = require('../controllers/clerkProfileController');

const router = express.Router();

router.post('/sync/me', clerkAuthMiddleware(), syncMe);

router.get('/profile', clerkAuthMiddleware(), getProfile);

router.put(
  '/profile',
  clerkAuthMiddleware(),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
    body('username').optional().isString().withMessage('Username must be a string'),
    body('skills').optional().isArray({ max: 50 }).withMessage('Skills must be an array (max 50)'),
    body('skills.*').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each skill must be 1-50 chars'),
    body('isProfilePublic').optional().isBoolean().withMessage('isProfilePublic must be true or false'),
    body('targetRole').optional().isString().isLength({ max: 100 }).withMessage('Target role must be a string (max 100 chars)'),
    body('experienceLevel')
      .optional()
      .isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
      .withMessage('Invalid experience level'),
    body('bio').optional().isString().isLength({ max: 1000 }).withMessage('Bio must be at most 1000 chars'),
    body('avatar')
      .optional()
      .isString()
      .isLength({ max: 1500000 })
      .withMessage('Avatar image is too large (max 1 MB)')
      .custom((v) => v === '' || /^data:image\/(png|jpe?g|gif|webp);base64,/.test(v) || /^https:\/\//.test(v))
      .withMessage('Avatar must be an uploaded image or an https URL')
  ],
  validateRequest,
  updateProfile
);

module.exports = router;
