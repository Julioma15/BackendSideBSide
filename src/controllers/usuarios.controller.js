const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarUsuarioNuevo } = require('../utils/validations');
const { ROL, ESTADO_REGISTRO } = require('../constants');
const { enviarCorreo } = require('../utils/email');
const { plantillaCorreo } = require('../utils/emailTemplate');

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

    // La contrasena temporal se genera y se manda por correo directo al
    // empleado: el admin nunca la ve ni pasa por el (protege al operador y
    // evita que quede expuesta en la UI o en logs del admin).
    const passwordTemporal = crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(passwordTemporal, SALT_ROUNDS);

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, email, contrasena, rol, num_empleado) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [nombre, email, hash, rol || ROL.OPERADOR, num_empleado || null]
    );

    await enviarCorreo({
      to: email,
      subject: 'Bienvenido a SideBSide — tu cuenta ya está lista',
      html: plantillaCorreo({
        titulo: `¡Bienvenido, ${nombre.split(' ')[0]}! 👋`,
        cuerpoHtml: `
          <p style="margin:0 0 16px;">Ya tienes acceso a SideBSide, la plataforma donde vas a registrar y dar seguimiento a tus gastos operativos.</p>
          <div style="background-color:#f9fafb;border:1px solid #eef0f3;border-radius:12px;padding:18px 20px;margin:0 0 20px;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;">Tus datos de acceso</p>
            <p style="margin:0 0 4px;"><strong>Correo:</strong> ${email}</p>
            <p style="margin:0;"><strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
          </div>
          <p style="margin:0 0 20px;text-align:center;">
            <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Iniciar sesión</a>
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">Por seguridad, cambia esta contraseña la primera vez que entres, desde <strong>Mi Perfil → Cambiar contraseña</strong>.</p>
        `,
      }),
    });

    res.status(201).json({
      id: resultado[0].id,
      nombre,
      email,
      rol: rol || ROL.OPERADOR,
      num_empleado: num_empleado || null,
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
