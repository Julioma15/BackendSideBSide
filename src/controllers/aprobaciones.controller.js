const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarRechazo } = require('../utils/validations');
const { ESTADO_GASTO, ESTADO_APROBACION } = require('../constants');

async function listarPendientes(req, res, next) {
  try {
    const { usuario_id, categoria_id, fecha_desde, fecha_hasta } = req.query;
    const condiciones = ['g.estado = ?'];
    const params = [ESTADO_GASTO.PENDIENTE];

    if (usuario_id) {
      condiciones.push('g.usuario_id = ?');
      params.push(usuario_id);
    }
    if (categoria_id) {
      condiciones.push('g.categoria_id = ?');
      params.push(categoria_id);
    }
    if (fecha_desde) {
      condiciones.push('g.fecha >= ?');
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      condiciones.push('g.fecha <= ?');
      params.push(fecha_hasta);
    }

    const [filas] = await pool.query(
      `SELECT g.id, g.monto, g.descripcion, g.foto_url, g.fecha, g.fecha_creacion,
              c.nombre AS categoria, u.nombre AS empleado, u.id AS usuario_id
       FROM gastos g
       JOIN categorias c ON c.id = g.categoria_id
       JOIN usuarios u ON u.id = g.usuario_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY g.fecha_creacion ASC`,
      params
    );

    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function obtenerPendiente(id) {
  const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ?', [id]);
  const gasto = filas[0];
  if (!gasto) {
    throw new AppError('Gasto no encontrado', 404);
  }
  if (gasto.estado !== ESTADO_GASTO.PENDIENTE) {
    throw new AppError('Solo se pueden aprobar/rechazar gastos pendientes', 400);
  }
  return gasto;
}

async function aprobar(req, res, next) {
  const conexion = await pool.getConnection();
  try {
    const gasto = await obtenerPendiente(req.params.id);

    await conexion.beginTransaction();
    await conexion.query('UPDATE gastos SET estado = ? WHERE id = ?', [ESTADO_GASTO.APROBADO, gasto.id]);
    await conexion.query(
      'INSERT INTO aprobaciones (gasto_id, admin_id, comentario, estado) VALUES (?, ?, ?, ?)',
      [gasto.id, req.user.id, req.body.comentario || null, ESTADO_APROBACION.APROBADO]
    );
    await conexion.commit();

    res.json({ mensaje: 'Gasto aprobado' });
  } catch (err) {
    await conexion.rollback();
    next(err);
  } finally {
    conexion.release();
  }
}

async function rechazar(req, res, next) {
  const conexion = await pool.getConnection();
  try {
    validarRechazo(req.body);
    const gasto = await obtenerPendiente(req.params.id);

    await conexion.beginTransaction();
    await conexion.query('UPDATE gastos SET estado = ? WHERE id = ?', [ESTADO_GASTO.RECHAZADO, gasto.id]);
    await conexion.query(
      'INSERT INTO aprobaciones (gasto_id, admin_id, comentario, estado) VALUES (?, ?, ?, ?)',
      [gasto.id, req.user.id, req.body.comentario, ESTADO_APROBACION.RECHAZADO]
    );
    await conexion.commit();

    res.json({ mensaje: 'Gasto rechazado' });
  } catch (err) {
    await conexion.rollback();
    next(err);
  } finally {
    conexion.release();
  }
}

module.exports = { listarPendientes, aprobar, rechazar };
