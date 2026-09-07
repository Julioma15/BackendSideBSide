const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarUsuarioNuevo } = require('../utils/validations');
const { ROL, ESTADO_REGISTRO } = require('../constants');

const SALT_ROUNDS = 10;

async function listar(req, res, next) {
  try {
    const [filas] = await pool.query(
      `SELECT id, nombre, email, rol, estado, num_empleado, fecha_creacion
       FROM usuarios ORDER BY nombre`
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    validarUsuarioNuevo(req.body);
    const { nombre, email, rol, num_empleado } = req.body;

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      throw new AppError('Ya existe un usuario con ese email', 409);
    }

    // No hay servicio de correo: se genera una temporal y se devuelve una
    // sola vez en la respuesta para que el admin se la comparta al empleado.
    const passwordTemporal = crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(passwordTemporal, SALT_ROUNDS);

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, email, contrasena, rol, num_empleado) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [nombre, email, hash, rol || ROL.OPERADOR, num_empleado || null]
    );

    res.status(201).json({
      id: resultado[0].id,
      nombre,
      email,
      rol: rol || ROL.OPERADOR,
      num_empleado: num_empleado || null,
      password_temporal: passwordTemporal,
    });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { id } = req.params;
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [id]);
    if (existentes.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // Soft-delete: un DELETE fisico rompe la FK gastos.usuario_id en cuanto
    // el usuario tenga algun gasto. Reusa el mismo enum activo/inactivo que
    // ya existe en la tabla.
    await pool.query('UPDATE usuarios SET estado = ? WHERE id = ?', [ESTADO_REGISTRO.INACTIVO, id]);
    res.json({ mensaje: 'Usuario desactivado' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, eliminar };
