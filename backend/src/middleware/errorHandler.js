function errorHandler(err, req, res, next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message: err && err.message ? err.message : 'Internal Server Error'
  });
}

module.exports = { errorHandler };
