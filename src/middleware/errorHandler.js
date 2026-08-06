function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const mensaje = err.expose ? err.message : 'Error interno del servidor';
  res.status(status).json({ error: mensaje });
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = { errorHandler, AppError };
