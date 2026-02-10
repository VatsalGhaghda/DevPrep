const { AppError } = require('../utils/AppError');

function requireOwnership({ Model, param = 'id', ownerField = 'userId' }) {
  if (!Model) {
    throw new Error('Model is required');
  }

  return async function ownershipMiddleware(req, res, next) {
    try {
      const id = req.params[param];
      const doc = await Model.findById(id);

      if (!doc) {
        return next(new AppError('Resource not found', 404));
      }

      const ownerId = doc[ownerField];
      if (req.user && req.user.role === 'admin') {
        req.resource = doc;
        return next();
      }

      if (!req.user || String(ownerId) !== String(req.user._id)) {
        return next(new AppError('Forbidden', 403));
      }

      req.resource = doc;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireOwnership };
