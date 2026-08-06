const { AppError } = require('../middleware/errorHandler');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarRegistro({ nombre, email, contrasena, rol }) {
  if (!nombre || nombre.trim().length < 2) {
    throw new AppError('El nombre es obligatorio', 400);
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError('El email no es valido', 400);
  }
  if (!contrasena || contrasena.length < 8) {
    throw new AppError('La contrasena debe tener al menos 8 caracteres', 400);
  }
  if (rol && !['operador', 'admin'].includes(rol)) {
    throw new AppError('Rol invalido', 400);
  }
}

function validarLogin({ email, contrasena }) {
  if (!email || !contrasena) {
    throw new AppError('Email y contrasena son obligatorios', 400);
  }
}

function validarGasto({ monto, categoria_id, fecha }) {
  if (monto === undefined || isNaN(monto) || Number(monto) <= 0) {
    throw new AppError('El monto debe ser un numero mayor a 0', 400);
  }
  if (!categoria_id || isNaN(categoria_id)) {
    throw new AppError('La categoria es obligatoria', 400);
  }
  if (!fecha || isNaN(Date.parse(fecha))) {
    throw new AppError('La fecha no es valida', 400);
  }
}

function validarRechazo({ comentario }) {
  if (!comentario || comentario.trim().length < 3) {
    throw new AppError('El comentario es obligatorio para rechazar un gasto', 400);
  }
}

module.exports = {
  validarRegistro,
  validarLogin,
  validarGasto,
  validarRechazo,
};
