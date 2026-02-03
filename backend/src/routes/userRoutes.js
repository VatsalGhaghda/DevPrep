const express = require('express');
const { body } = require('express-validator');

const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { getProfile, updateProfile, getStats } = require('../controllers/userController');

const router = express.Router();

router.get('/profile', protect, getProfile);

router.put(
  '/profile',
  protect,
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

router.get('/stats', protect, getStats);

module.exports = router;
