const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

async function listar(req, res, next) {
  try {
    const [filas] = await pool.query(
      'SELECT id, nombre, descripcion, estado FROM categorias ORDER BY nombre'
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre || nombre.trim().length < 2) {
      throw new AppError('El nombre de la categoria es obligatorio', 400);
    }

    const [existentes] = await pool.query('SELECT id FROM categorias WHERE nombre = ?', [nombre]);
    if (existentes.length > 0) {
      throw new AppError('Ya existe una categoria con ese nombre', 409);
    }

    const [resultado] = await pool.query(
      'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?) RETURNING id',
      [nombre, descripcion || null]
    );

    res.status(201).json({ id: resultado[0].id, nombre, descripcion: descripcion || null });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;

    const [existentes] = await pool.query('SELECT id FROM categorias WHERE id = ?', [id]);
    if (existentes.length === 0) {
      throw new AppError('Categoria no encontrada', 404);
    }
    if (estado && !['activo', 'inactivo'].includes(estado)) {
      throw new AppError('Estado invalido', 400);
    }

    await pool.query(
      'UPDATE categorias SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion), estado = COALESCE(?, estado) WHERE id = ?',
      [nombre || null, descripcion ?? null, estado || null, id]
    );

    res.json({ mensaje: 'Categoria actualizada' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar };
