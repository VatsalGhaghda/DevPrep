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
    body('skills').optional().isArray().withMessage('Skills must be an array'),
    body('targetRole').optional().isString().withMessage('Target role must be a string'),
    body('experienceLevel')
      .optional()
      .isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
      .withMessage('Invalid experience level'),
    body('bio').optional().isString().withMessage('Bio must be a string'),
    body('avatar').optional().isString().withMessage('Avatar must be a string')
  ],
  validateRequest,
  updateProfile
);

module.exports = router;
