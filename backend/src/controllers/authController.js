const crypto = require('crypto');

const User = require('../models/User');
const { signToken, verifyToken } = require('../utils/jwt');
const { generateResetToken } = require('../utils/tokens');

async function register(req, res, next) {
  console.log('register controller hit', { body: req.body });
  if (typeof next !== 'function') {
    return res.status(500).json({ message: 'Internal server error: middleware misconfigured' });
  }
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400);
      throw new Error('Email is already registered');
    }

    const user = await User.create({ name, email, password });

    const token = signToken({ id: user._id });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('register error', err);
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

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    const token = signToken({ id: user._id });

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

    const { token, tokenHash } = generateResetToken();

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    res.status(200).json({
      message: 'Reset token generated',
      resetToken: token
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
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

    const jwtToken = signToken({ id: user._id });

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

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  verify
};
