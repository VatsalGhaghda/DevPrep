function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  res.status(403);
  return next(new Error('Forbidden: Admin access required'));
}

module.exports = { adminOnly };
