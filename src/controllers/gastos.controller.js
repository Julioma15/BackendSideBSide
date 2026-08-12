const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarGasto } = require('../utils/validations');

const ESTADOS_EDITABLES = ['borrador', 'pendiente'];

async function crear(req, res, next) {
  try {
    validarGasto(req.body);
    const { monto, categoria_id, descripcion, fecha, enviar } = req.body;
    const estado = enviar ? 'pendiente' : 'borrador';

    const [resultado] = await pool.query(
      `INSERT INTO gastos (usuario_id, categoria_id, monto, descripcion, fecha, estado)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [req.user.id, categoria_id, monto, descripcion || null, fecha, estado]
    );

    res.status(201).json({ id: resultado[0].id, estado });
  } catch (err) {
    next(err);
  }
}

async function listar(req, res, next) {
  try {
    const { estado, categoria_id, fecha_desde, fecha_hasta, usuario_id } = req.query;
    const condiciones = [];
    const params = [];

    if (req.user.rol !== 'admin') {
      condiciones.push('g.usuario_id = ?');
      params.push(req.user.id);
    } else if (usuario_id) {
      condiciones.push('g.usuario_id = ?');
      params.push(usuario_id);
    }

    if (estado) {
      condiciones.push('g.estado = ?');
      params.push(estado);
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

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [filas] = await pool.query(
      `SELECT g.id, g.monto, g.descripcion, g.foto_url, g.estado, g.fecha, g.fecha_creacion,
              c.nombre AS categoria, u.nombre AS empleado, u.id AS usuario_id
       FROM gastos g
       JOIN categorias c ON c.id = g.categoria_id
       JOIN usuarios u ON u.id = g.usuario_id
       ${where}
       ORDER BY g.fecha_creacion DESC`,
      params
    );

    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function obtenerGastoOAutorizar(id, user) {
  const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ?', [id]);
  const gasto = filas[0];
  if (!gasto) {
    throw new AppError('Gasto no encontrado', 404);
  }
  if (user.rol !== 'admin' && gasto.usuario_id !== user.id) {
    throw new AppError('No tienes permiso sobre este gasto', 403);
  }
  return gasto;
}

async function obtenerUno(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    res.json(gasto);
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede editarlo', 403);
    }
    if (!ESTADOS_EDITABLES.includes(gasto.estado)) {
      throw new AppError('Solo se pueden editar gastos en borrador o pendientes', 400);
    }

    const { monto, categoria_id, descripcion, fecha, enviar } = req.body;
    const estado = enviar ? 'pendiente' : gasto.estado;

    await pool.query(
      `UPDATE gastos SET
        monto = COALESCE(?, monto),
        categoria_id = COALESCE(?, categoria_id),
        descripcion = COALESCE(?, descripcion),
        fecha = COALESCE(?, fecha),
        estado = ?
       WHERE id = ?`,
      [monto ?? null, categoria_id ?? null, descripcion ?? null, fecha ?? null, estado, gasto.id]
    );

    res.json({ mensaje: 'Gasto actualizado' });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede eliminarlo', 403);
    }
    if (!ESTADOS_EDITABLES.includes(gasto.estado)) {
      throw new AppError('Solo se pueden eliminar gastos en borrador o pendientes', 400);
    }

    await pool.query('DELETE FROM gastos WHERE id = ?', [gasto.id]);
    res.json({ mensaje: 'Gasto eliminado' });
  } catch (err) {
    next(err);
  }
}

async function subirComprobante(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede subir el comprobante', 403);
    }
    if (!req.file) {
      throw new AppError('No se recibio ninguna imagen', 400);
    }

    const fotoUrl = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE gastos SET foto_url = ? WHERE id = ?', [fotoUrl, gasto.id]);

    res.json({ foto_url: fotoUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  crear,
  listar,
  obtenerUno,
  actualizar,
  eliminar,
  subirComprobante,
  obtenerGastoOAutorizar,
};
