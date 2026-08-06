const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarRegistro, validarLogin } = require('../utils/validations');

const SALT_ROUNDS = 10;

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
  );
}

async function register(req, res, next) {
  try {
    validarRegistro(req.body);
    const { nombre, email, contrasena, rol, empresa } = req.body;

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      throw new AppError('Ya existe un usuario con ese email', 409);
    }

    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, email, contrasena, rol, empresa) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, hash, rol || 'operador', empresa || null]
    );

    res.status(201).json({
      id: resultado.insertId,
      nombre,
      email,
      rol: rol || 'operador',
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    validarLogin(req.body);
    const { email, contrasena } = req.body;

    const [filas] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const usuario = filas[0];

    if (!usuario || usuario.estado !== 'activo') {
      throw new AppError('Credenciales invalidas', 401);
    }

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      throw new AppError('Credenciales invalidas', 401);
    }

    const token = generarToken(usuario);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  // JWT es stateless: el logout real ocurre en el cliente descartando el token.
  res.json({ mensaje: 'Sesion cerrada' });
}

async function cambiarContrasena(req, res, next) {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva || nueva.length < 8) {
      throw new AppError('Contrasena actual y nueva (min. 8 caracteres) son obligatorias', 400);
    }

    const [filas] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    const usuario = filas[0];

    const coincide = await bcrypt.compare(actual, usuario.contrasena);
    if (!coincide) {
      throw new AppError('La contrasena actual no es correcta', 401);
    }

    const hash = await bcrypt.hash(nueva, SALT_ROUNDS);
    await pool.query('UPDATE usuarios SET contrasena = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ mensaje: 'Contrasena actualizada' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, cambiarContrasena };
