const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarRegistro, validarLogin, validarFortalezaContrasena } = require('../utils/validations');
const { ROL, ESTADO_REGISTRO } = require('../constants');
const { enviarCorreo } = require('../utils/email');
const { plantillaCorreo } = require('../utils/emailTemplate');

const SALT_ROUNDS = 10;
const RESET_TOKEN_VIGENCIA_MS = 60 * 60 * 1000; // 1 hora

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
      'INSERT INTO usuarios (nombre, email, contrasena, rol, empresa) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [nombre, email, hash, rol || ROL.OPERADOR, empresa || null]
    );

    res.status(201).json({
      id: resultado[0].id,
      nombre,
      email,
      rol: rol || ROL.OPERADOR,
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

    // Mensajes especificos a proposito (a diferencia de olvideContrasena, que
    // los unifica para no permitir enumerar cuentas): aqui el usuario ya
    // demostro que conoce el correo con solo escribirlo en el formulario de
    // login, asi que decirle "no existe esa cuenta" no filtra nada nuevo, y
    // ayuda mucho mas que un generico "usuario o contrasena incorrecta".
    if (!usuario) {
      throw new AppError('No existe ninguna cuenta con ese correo', 404);
    }
    if (usuario.estado !== ESTADO_REGISTRO.ACTIVO) {
      throw new AppError('Esta cuenta esta desactivada. Contacta a tu administrador', 403);
    }

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      throw new AppError('La contrasena no es correcta', 401);
    }

    const token = generarToken(usuario);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        num_empleado: usuario.num_empleado,
        zona_horaria: usuario.zona_horaria,
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
    if (!actual || !nueva) {
      throw new AppError('Contrasena actual y nueva son obligatorias', 400);
    }
    validarFortalezaContrasena(nueva);

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

// RF: recuperacion de contrasena por correo. Respuesta identica exista o no
// el email (evita que alguien use este endpoint para enumerar cuentas).
async function olvideContrasena(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      throw new AppError('El correo es obligatorio', 400);
    }

    const [filas] = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE email = ? AND estado = ?',
      [email, ESTADO_REGISTRO.ACTIVO]
    );
    const usuario = filas[0];

    if (usuario) {
      const tokenPlano = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
      const expira = new Date(Date.now() + RESET_TOKEN_VIGENCIA_MS);

      await pool.query(
        'UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE id = ?',
        [tokenHash, expira, usuario.id]
      );

      const enlace = `${process.env.FRONTEND_URL}/restablecer-contrasena?token=${tokenPlano}`;
      await enviarCorreo({
        to: usuario.email,
        subject: 'Recupera tu contrasena — SideBSide',
        html: plantillaCorreo({
          titulo: 'Recupera tu contraseña',
          cuerpoHtml: `
            <p style="margin:0 0 16px;">Hola ${usuario.nombre},</p>
            <p style="margin:0 0 20px;">Recibimos una solicitud para restablecer tu contraseña. Este enlace es válido por <strong>1 hora</strong>:</p>
            <p style="margin:0 0 20px;text-align:center;">
              <a href="${enlace}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Restablecer contraseña</a>
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="${enlace}" style="color:#2563eb;word-break:break-all;">${enlace}</a></p>
            <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">Si tú no pediste esto, ignora este correo — tu contraseña sigue igual.</p>
          `,
        }),
      });
    }

    res.json({ mensaje: 'Si el correo existe, te enviamos un enlace para restablecer tu contrasena' });
  } catch (err) {
    next(err);
  }
}

async function restablecerContrasena(req, res, next) {
  try {
    const { token, nueva } = req.body;
    if (!token || !nueva) {
      throw new AppError('Token y nueva contrasena son obligatorios', 400);
    }
    validarFortalezaContrasena(nueva);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [filas] = await pool.query(
      'SELECT id, reset_token_expira FROM usuarios WHERE reset_token = ?',
      [tokenHash]
    );
    const usuario = filas[0];

    if (!usuario || !usuario.reset_token_expira || new Date(usuario.reset_token_expira) < new Date()) {
      throw new AppError('El enlace es invalido o ya expiro. Solicita uno nuevo.', 400);
    }

    const hash = await bcrypt.hash(nueva, SALT_ROUNDS);
    await pool.query(
      'UPDATE usuarios SET contrasena = ?, reset_token = NULL, reset_token_expira = NULL WHERE id = ?',
      [hash, usuario.id]
    );

    res.json({ mensaje: 'Contrasena restablecida, ya puedes iniciar sesion' });
  } catch (err) {
    next(err);
  }
}

async function actualizarZonaHoraria(req, res, next) {
  try {
    const { zona_horaria } = req.body;
    if (!zona_horaria || typeof zona_horaria !== 'string') {
      throw new AppError('La zona horaria es obligatoria', 400);
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: zona_horaria });
    } catch {
      throw new AppError('Zona horaria invalida', 400);
    }

    await pool.query('UPDATE usuarios SET zona_horaria = ? WHERE id = ?', [zona_horaria, req.user.id]);
    res.json({ mensaje: 'Zona horaria actualizada', zona_horaria });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  cambiarContrasena,
  olvideContrasena,
  restablecerContrasena,
  actualizarZonaHoraria,
};
