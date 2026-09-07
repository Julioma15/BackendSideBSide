const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarViaje } = require('../utils/validations');
const { ROL, ESTADOS_VIAJE_VALIDOS } = require('../constants');

async function crear(req, res, next) {
  try {
    validarViaje(req.body);
    const { nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto } = req.body;

    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [usuario_id]);
    if (usuarios.length === 0) {
      throw new AppError('El usuario asignado no existe', 404);
    }

    const [resultado] = await pool.query(
      `INSERT INTO viajes (nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto]
    );

    res.status(201).json({ id: resultado[0].id });
  } catch (err) {
    next(err);
  }
}

async function listar(req, res, next) {
  try {
    const condiciones = [];
    const params = [];

    if (req.user.rol !== ROL.ADMIN) {
      condiciones.push('v.usuario_id = ?');
      params.push(req.user.id);
    } else if (req.query.usuario_id) {
      condiciones.push('v.usuario_id = ?');
      params.push(req.query.usuario_id);
    }
    if (req.query.estado) {
      condiciones.push('v.estado = ?');
      params.push(req.query.estado);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [filas] = await pool.query(
      `SELECT v.id, v.nombre, v.usuario_id, u.nombre AS usuario, v.fecha_inicio, v.fecha_fin,
              v.presupuesto, v.estado, v.fecha_creacion
       FROM viajes v
       JOIN usuarios u ON u.id = v.usuario_id
       ${where}
       ORDER BY v.fecha_creacion DESC`,
      params
    );

    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function obtenerViajeOAutorizar(id, user) {
  const [filas] = await pool.query('SELECT * FROM viajes WHERE id = ?', [id]);
  const viaje = filas[0];
  if (!viaje) {
    throw new AppError('Viaje no encontrado', 404);
  }
  if (user.rol !== ROL.ADMIN && viaje.usuario_id !== user.id) {
    throw new AppError('No tienes permiso sobre este viaje', 403);
  }
  return viaje;
}

async function obtenerUno(req, res, next) {
  try {
    const viaje = await obtenerViajeOAutorizar(req.params.id, req.user);
    res.json(viaje);
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const viaje = await obtenerViajeOAutorizar(req.params.id, req.user);
    const { nombre, fecha_inicio, fecha_fin, presupuesto, estado } = req.body;

    if (estado && !ESTADOS_VIAJE_VALIDOS.includes(estado)) {
      throw new AppError('Estado invalido', 400);
    }

    await pool.query(
      `UPDATE viajes SET
        nombre = COALESCE(?, nombre),
        fecha_inicio = COALESCE(?, fecha_inicio),
        fecha_fin = COALESCE(?, fecha_fin),
        presupuesto = COALESCE(?, presupuesto),
        estado = COALESCE(?, estado)
       WHERE id = ?`,
      [nombre || null, fecha_inicio || null, fecha_fin || null, presupuesto ?? null, estado || null, viaje.id]
    );

    res.json({ mensaje: 'Viaje actualizado' });
  } catch (err) {
    next(err);
  }
}

module.exports = { crear, listar, obtenerUno, actualizar, obtenerViajeOAutorizar };
