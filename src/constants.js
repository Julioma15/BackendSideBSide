// Fuente unica de verdad para los valores que antes estaban repetidos como
// cadenas sueltas en controllers, validaciones y el CHECK de schema.sql.
// Si se agrega un valor aqui, hay que reflejarlo tambien en sql/schema.sql.

const ESTADO_GASTO = {
  BORRADOR: 'borrador',
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
};

const ESTADO_APROBACION = {
  APROBADO: ESTADO_GASTO.APROBADO,
  RECHAZADO: ESTADO_GASTO.RECHAZADO,
};

const ROL = {
  OPERADOR: 'operador',
  ADMIN: 'admin',
};

const ESTADO_REGISTRO = {
  ACTIVO: 'activo',
  INACTIVO: 'inactivo',
};

const ESTADO_VIAJE = {
  ACTIVO: 'activo',
  COMPLETADO: 'completado',
};

const MONEDAS_VALIDAS = ['MXN', 'USD', 'EUR'];

// Un gasto solo se puede editar o borrar mientras no haya sido revisado.
const ESTADOS_EDITABLES = [ESTADO_GASTO.BORRADOR, ESTADO_GASTO.PENDIENTE];

module.exports = {
  ESTADO_GASTO,
  ESTADO_APROBACION,
  ROL,
  ESTADO_REGISTRO,
  ESTADO_VIAJE,
  ESTADOS_EDITABLES,
  ROLES_VALIDOS: Object.values(ROL),
  ESTADOS_GASTO_VALIDOS: Object.values(ESTADO_GASTO),
  ESTADOS_REGISTRO_VALIDOS: Object.values(ESTADO_REGISTRO),
  ESTADOS_VIAJE_VALIDOS: Object.values(ESTADO_VIAJE),
  MONEDAS_VALIDAS,
};
