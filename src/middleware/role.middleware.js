const { AppError } = require('./errorHandler');

function soloAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return next(new AppError('Acceso restringido a administradores', 403));
  }
  next();
}

module.exports = { soloAdmin };
