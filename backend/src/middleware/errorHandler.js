/**
 * Central error handler.
 *
 * Status code, in order of precedence:
 *   1. err.statusCode / err.status (AppError, http-errors, body-parser)
 *   2. a status a controller already set with res.status(...) before throwing
 *   3. well-known error types (Mongoose cast/validation, Multer, bad JSON)
 *   4. 500
 *
 * 5xx messages are hidden in production so internals don't leak to clients.
 */
function statusFromError(err, res) {
  if (!err) return 500;
  const explicit = err.statusCode || err.status;
  if (Number.isInteger(explicit) && explicit >= 400 && explicit < 600) return explicit;
  if (res.statusCode && res.statusCode >= 400) return res.statusCode;
  if (err.name === 'CastError' || err.name === 'ValidationError' || err.name === 'StrictModeError') return 400;
  if (err.name === 'MulterError') return err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  if (err.name === 'VersionError') return 409;
  if (err.code === 11000) return 409; // duplicate key
  return 500;
}

function messageFromError(err, status) {
  if (!err) return 'Internal Server Error';
  if (err.name === 'CastError') return `Invalid ${err.path || 'value'}`;
  if (err.name === 'VersionError') return 'This item was changed by another request. Please retry.';
  if (err.code === 11000) return 'That value is already in use';
  if (err.type === 'entity.parse.failed') return 'Request body is not valid JSON';
  if (err.type === 'entity.too.large') return 'Request body is too large';
  if (status >= 500 && process.env.NODE_ENV === 'production') return 'Internal Server Error';
  return err.message || 'Internal Server Error';
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = statusFromError(err, res);
  const payload = { message: messageFromError(err, status) };

  if (err && Array.isArray(err.details)) {
    payload.details = err.details;
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  if (process.env.NODE_ENV === 'development') {
    payload.stack = err && err.stack ? err.stack : undefined;
    if (err && err.body && !payload.details) {
      payload.details = err.body;
    }
  }

  if (res.headersSent) return undefined;
  return res.status(status).json(payload);
}

module.exports = { errorHandler };
