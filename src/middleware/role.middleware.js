const { AppError } = require('./errorHandler');
const { ROL } = require('../constants');

function soloAdmin(req, res, next) {
  if (!req.user || req.user.rol !== ROL.ADMIN) {
    return next(new AppError('Acceso restringido a administradores', 403));
  }
  next();
}

module.exports = { soloAdmin };
