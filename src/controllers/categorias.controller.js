const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { ESTADOS_REGISTRO_VALIDOS, ESTADO_REGISTRO } = require('../constants');

async function listar(req, res, next) {
  try {
    const [filas] = await pool.query(
      'SELECT id, nombre, descripcion, estado, color, icono FROM categorias ORDER BY nombre'
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion, color, icono } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      throw new AppError('El nombre de la categoria es obligatorio', 400);
    }

    const [existentes] = await pool.query('SELECT id FROM categorias WHERE nombre = ?', [nombre]);
    if (existentes.length > 0) {
      throw new AppError('Ya existe una categoria con ese nombre', 409);
    }

    const [resultado] = await pool.query(
      'INSERT INTO categorias (nombre, descripcion, color, icono) VALUES (?, ?, ?, ?) RETURNING id, color, icono',
      [nombre, descripcion || null, color || '#6b7280', icono || 'Package']
    );

    res.status(201).json({
      id: resultado[0].id,
      nombre,
      descripcion: descripcion || null,
      color: resultado[0].color,
      icono: resultado[0].icono,
    });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado, color, icono } = req.body;

    const [existentes] = await pool.query('SELECT id FROM categorias WHERE id = ?', [id]);
    if (existentes.length === 0) {
      throw new AppError('Categoria no encontrada', 404);
    }
    if (estado && !ESTADOS_REGISTRO_VALIDOS.includes(estado)) {
      throw new AppError('Estado invalido', 400);
    }

    await pool.query(
      `UPDATE categorias SET
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        estado = COALESCE(?, estado),
        color = COALESCE(?, color),
        icono = COALESCE(?, icono)
       WHERE id = ?`,
      [nombre || null, descripcion ?? null, estado || null, color || null, icono || null, id]
    );

    res.json({ mensaje: 'Categoria actualizada' });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { id } = req.params;
    const [existentes] = await pool.query('SELECT id FROM categorias WHERE id = ?', [id]);
    if (existentes.length === 0) {
      throw new AppError('Categoria no encontrada', 404);
    }

    const [conteo] = await pool.query('SELECT COUNT(*) AS total FROM gastos WHERE categoria_id = ?', [id]);
    if (Number(conteo[0].total) > 0) {
      // Un DELETE fisico rompe la FK gastos.categoria_id en cuanto la
      // categoria tenga algun gasto: se desactiva en su lugar, igual que
      // usuarios.eliminar.
      await pool.query('UPDATE categorias SET estado = ? WHERE id = ?', [ESTADO_REGISTRO.INACTIVO, id]);
      return res.json({ mensaje: 'Categoria en uso: se desactivo en lugar de eliminarse' });
    }

    await pool.query('DELETE FROM categorias WHERE id = ?', [id]);
    res.json({ mensaje: 'Categoria eliminada' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar };
