function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
