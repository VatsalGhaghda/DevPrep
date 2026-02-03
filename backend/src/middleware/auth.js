const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

async function protect(req, res, next) {
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

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { protect };
