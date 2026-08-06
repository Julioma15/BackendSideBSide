const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

function verificarToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401));
  }

  const token = header.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return next(new AppError('Token invalido o expirado', 401));
    }
    req.user = payload;
    next();
  });
}

module.exports = { verificarToken };
