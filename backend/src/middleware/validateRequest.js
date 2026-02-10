const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400);
    const arr = errors.array();
    const message = arr.map((e) => e.msg).join(', ');
    const err = new Error(message);
    err.details = arr.map((e) => ({ field: e.path, message: e.msg }));
    return next(err);
  }

  return next();
}

module.exports = { validateRequest };
