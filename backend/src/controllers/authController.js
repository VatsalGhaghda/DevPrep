const crypto = require('crypto');

const User = require('../models/User');
const { signToken, verifyToken } = require('../utils/jwt');
const { generateResetToken, generateEmailVerificationToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400);
      throw new Error('Email is already registered');
    }

    const { token: verifyTokenRaw, tokenHash } = generateEmailVerificationToken();

    const user = await User.create({
      name,
      email,
      password,
      isEmailVerified: false,
      emailVerificationToken: tokenHash,
      emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000)
    });

    try {
      await sendVerificationEmail({ to: user.email, token: verifyTokenRaw });
    } catch (err) {
      // If email sending fails, keep user unverified but return clear message
    }

    res.status(201).json({
      message: 'Account created. Please verify your email to log in.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      res.status(403);
      throw new Error('Email not verified');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    const token = signToken({ id: user._id, role: user.role });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(200).json({ message: 'If that email exists, a reset token has been generated' });
      return;
    }

    if (!user.isEmailVerified) {
      res.status(403);
      throw new Error('Email not verified');
    }

    const { token, tokenHash } = generateResetToken();

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail({ to: user.email, token });
    } catch (err) {
      // Keep response generic to avoid leaking internal details
    }

    res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, email, password } = req.body;

    if (!token || !email) {
      res.status(400);
      throw new Error('Token and email are required');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+password');

    if (!user) {
      res.status(400);
      throw new Error('Invalid or expired reset token');
    }

    user.password = password;
    user.resetPasswordToken = '';
    user.resetPasswordExpires = null;
    await user.save();

    const jwtToken = signToken({ id: user._id, role: user.role });

    res.status(200).json({
      message: 'Password reset successful',
      token: jwtToken
    });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const parts = header.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401);
      throw new Error('Not authorized');
    }

    const decoded = verifyToken(parts[1]);

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      res.status(400);
      throw new Error('Token and email are required');
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400);
      throw new Error('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = '';
    user.emailVerificationExpires = null;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      res.status(200).json({ message: 'If that email exists, a verification email has been sent' });
      return;
    }

    if (user.isEmailVerified) {
      res.status(200).json({ message: 'Email is already verified' });
      return;
    }

    const { token: verifyTokenRaw, tokenHash } = generateEmailVerificationToken();
    user.emailVerificationToken = tokenHash;
    user.emailVerificationExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail({ to: user.email, token: verifyTokenRaw });

    res.status(200).json({ message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  verify,
  verifyEmail,
  resendVerification
};
