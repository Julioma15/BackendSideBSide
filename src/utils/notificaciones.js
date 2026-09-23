// `conexion` puede ser el `pool` global o una conexion de transaccion de
// `pool.getConnection()` - ambos exponen `.query(sql, params)` con el mismo
// shim mysql2-style, asi que estas funciones sirven para ambos casos.

async function crearNotificacion(conexion, { usuario_id, tipo, titulo, detalle }) {
  await conexion.query(
    'INSERT INTO notificaciones (usuario_id, tipo, titulo, detalle) VALUES (?, ?, ?, ?)',
    [usuario_id, tipo, titulo, detalle || null]
  );
}

// Fan-out a todos los admins activos (ej. gasto nuevo pendiente). Una sola
// query, sin loop de INSERTs por admin.
async function crearNotificacionAdmins(conexion, { tipo, titulo, detalle }) {
  await conexion.query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, detalle)
     SELECT id, ?, ?, ? FROM usuarios WHERE rol = 'admin' AND estado = 'activo'`,
    [tipo, titulo, detalle || null]
  );
}

module.exports = { crearNotificacion, crearNotificacionAdmins };
