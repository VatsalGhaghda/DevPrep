const jwt = require('jsonwebtoken');

function signToken(payload, options = {}) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return jwt.sign(payload, secret, { expiresIn: '7d', ...options });
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken };
