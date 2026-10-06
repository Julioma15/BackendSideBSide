function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  // En las pruebas se provocan 400/403/404 a proposito: solo se loguean los
  // 500, que si son inesperados.
  if (process.env.NODE_ENV !== 'test' || status >= 500) console.error(err);
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
