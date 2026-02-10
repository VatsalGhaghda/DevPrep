function errorHandler(err, req, res, next) {
  const statusCode =
    (err && err.statusCode) || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  const payload = {
    message: err && err.message ? err.message : 'Internal Server Error'
  };

  if (err && Array.isArray(err.details)) {
    payload.details = err.details;
  }

  if (err && err.name === 'MulterError') {
    payload.message = err.message || 'File upload error';
    if (!err.statusCode) {
      res.status(400);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    payload.stack = err && err.stack ? err.stack : undefined;
  }

  const finalStatus =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : statusCode;
  res.status(finalStatus).json(payload);
}

module.exports = { errorHandler };
