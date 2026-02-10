const express = require('express');
const { body, query } = require('express-validator');

const {
  register,
  login,
  forgotPassword,
  resetPassword,
  verify,
  verifyEmail,
  resendVerification
} = require('../controllers/authController');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validateRequest,
  login
);

router.post(
  '/forgot-password',
  [body('email').trim().isEmail().withMessage('Valid email is required')],
  validateRequest,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validateRequest,
  resetPassword
);

router.get('/verify', verify);

router.get(
  '/verify-email',
  [query('token').notEmpty().withMessage('Token is required'), query('email').isEmail().withMessage('Valid email is required')],
  validateRequest,
  verifyEmail
);

router.post(
  '/resend-verification',
  [body('email').trim().isEmail().withMessage('Valid email is required')],
  validateRequest,
  resendVerification
);

module.exports = router;
