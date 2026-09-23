const { AppError } = require('../middleware/errorHandler');
const { ROLES_VALIDOS, MONEDAS_VALIDAS } = require('../constants');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimo 8 caracteres, al menos una letra y al menos un numero. No exige
// simbolos para no ser tan estricto como para frustrar al usuario final
// (personal de campo, no siempre tecnico), pero evita contrasenas trivales
// como "12345678" o "aaaaaaaa".
const CONTRASENA_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function validarFortalezaContrasena(contrasena) {
  if (!contrasena || !CONTRASENA_REGEX.test(contrasena)) {
    throw new AppError('La contrasena debe tener al menos 8 caracteres, con letras y numeros', 400);
  }
}

function validarRegistro({ nombre, email, contrasena, rol }) {
  if (!nombre || nombre.trim().length < 2) {
    throw new AppError('El nombre es obligatorio', 400);
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError('El email no es valido', 400);
  }
  validarFortalezaContrasena(contrasena);
  if (rol && !ROLES_VALIDOS.includes(rol)) {
    throw new AppError('Rol invalido', 400);
  }
}

function validarLogin({ email, contrasena }) {
  if (!email || !contrasena) {
    throw new AppError('Email y contrasena son obligatorios', 400);
  }
}

// Nuevo usuario creado por un admin (src/controllers/usuarios.controller.js):
// no pide contrasena porque el backend genera una temporal.
function validarUsuarioNuevo({ nombre, email, rol }) {
  if (!nombre || nombre.trim().length < 2) {
    throw new AppError('El nombre es obligatorio', 400);
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError('El email no es valido', 400);
  }
  if (rol && !ROLES_VALIDOS.includes(rol)) {
    throw new AppError('Rol invalido', 400);
  }
}

function validarGasto({ monto, categoria_id, fecha, viaje_id, moneda, iva }) {
  if (monto === undefined || isNaN(monto) || Number(monto) <= 0) {
    throw new AppError('El monto debe ser un numero mayor a 0', 400);
  }
  if (!categoria_id || isNaN(categoria_id)) {
    throw new AppError('La categoria es obligatoria', 400);
  }
  if (!fecha || isNaN(Date.parse(fecha))) {
    throw new AppError('La fecha no es valida', 400);
  }
  if (!viaje_id || isNaN(viaje_id)) {
    throw new AppError('El viaje es obligatorio', 400);
  }
  if (moneda && !MONEDAS_VALIDAS.includes(moneda)) {
    throw new AppError('Moneda invalida', 400);
  }
  // El IVA es opcional (no toda factura lo desglosa) pero, si se manda, va
  // incluido en el monto: no puede ser negativo ni superarlo.
  if (iva !== undefined && iva !== null && iva !== '') {
    if (isNaN(iva) || Number(iva) < 0) {
      throw new AppError('El IVA debe ser un numero mayor o igual a 0', 400);
    }
    if (monto !== undefined && !isNaN(monto) && Number(iva) > Number(monto)) {
      throw new AppError('El IVA no puede ser mayor al monto del gasto', 400);
    }
  }
}

function validarRechazo({ comentario }) {
  if (!comentario || comentario.trim().length < 3) {
    throw new AppError('El comentario es obligatorio para rechazar un gasto', 400);
  }
}

function validarViaje({ nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto }) {
  if (!nombre || nombre.trim().length < 2) {
    throw new AppError('El nombre del viaje es obligatorio', 400);
  }
  if (!usuario_id || isNaN(usuario_id)) {
    throw new AppError('El usuario asignado es obligatorio', 400);
  }
  if (!fecha_inicio || isNaN(Date.parse(fecha_inicio))) {
    throw new AppError('La fecha de inicio no es valida', 400);
  }
  if (!fecha_fin || isNaN(Date.parse(fecha_fin))) {
    throw new AppError('La fecha de fin no es valida', 400);
  }
  if (new Date(fecha_fin) < new Date(fecha_inicio)) {
    throw new AppError('La fecha de fin no puede ser anterior a la de inicio', 400);
  }
  // El presupuesto es opcional en el formulario del front (Viajes.jsx lo marca
  // "opcional" y manda 0 si se deja vacio), asi que aqui solo se exige que no
  // sea negativo, no que sea mayor a 0.
  if (presupuesto === undefined || isNaN(presupuesto) || Number(presupuesto) < 0) {
    throw new AppError('El presupuesto no puede ser negativo', 400);
  }
}

module.exports = {
  validarRegistro,
  validarLogin,
  validarUsuarioNuevo,
  validarGasto,
  validarRechazo,
  validarViaje,
  validarFortalezaContrasena,
};
