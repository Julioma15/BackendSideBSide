const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarViaje } = require('../utils/validations');
const { ROL, ESTADO_VIAJE, ESTADOS_VIAJE_VALIDOS, TIPO_NOTIFICACION } = require('../constants');
const { crearNotificacion } = require('../utils/notificaciones');
const { enviarCorreo } = require('../utils/email');
const { plantillaCorreo } = require('../utils/emailTemplate');

async function crear(req, res, next) {
  const conexion = await pool.getConnection();
  try {
    validarViaje(req.body);
    const { nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto } = req.body;

    const [usuarios] = await pool.query('SELECT id, nombre, email FROM usuarios WHERE id = ?', [usuario_id]);
    const operador = usuarios[0];
    if (!operador) {
      throw new AppError('El usuario asignado no existe', 404);
    }

    await conexion.beginTransaction();

    const [resultado] = await conexion.query(
      `INSERT INTO viajes (nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto]
    );

    await crearNotificacion(conexion, {
      usuario_id,
      tipo: TIPO_NOTIFICACION.VIAJE,
      titulo: `Nuevo viaje asignado: ${nombre}`,
      detalle: `${fecha_inicio} → ${fecha_fin}`,
    });

    await conexion.commit();

    // El correo va DESPUES del commit y en su propio try/catch: el viaje ya
    // quedo asignado (que es lo que realmente importa) y un problema de SMTP
    // no deberia tumbar la respuesta 201 ni, mucho menos, deshacer el viaje.
    try {
      await enviarCorreo({
        to: operador.email,
        subject: `Nuevo viaje asignado: ${nombre}`,
        html: plantillaCorreo({
          titulo: `Se te asignó un nuevo viaje 🧳`,
          cuerpoHtml: `
            <p style="margin:0 0 16px;">Hola ${operador.nombre.split(' ')[0]},</p>
            <p style="margin:0 0 20px;">Tu administrador te asignó un nuevo viaje. Este es el resumen:</p>
            <div style="background-color:#f9fafb;border:1px solid #eef0f3;border-radius:12px;padding:18px 20px;margin:0 0 20px;">
              <p style="margin:0 0 10px;font-size:16px;font-weight:bold;color:#1a2456;">${nombre}</p>
              <p style="margin:0 0 4px;"><strong>Fechas:</strong> ${fecha_inicio} → ${fecha_fin}</p>
              <p style="margin:0;"><strong>Presupuesto:</strong> ${presupuesto > 0 ? `$${Number(presupuesto).toFixed(2)}` : 'Sin presupuesto asignado'}</p>
            </div>
            <p style="margin:0 0 20px;text-align:center;">
              <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Ver mis viajes</a>
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px;">Ya puedes empezar a registrar tus gastos de este viaje desde la plataforma.</p>
          `,
        }),
      });
    } catch (errCorreo) {
      console.warn(`[email] No se pudo enviar el correo de viaje asignado a ${operador.email}:`, errCorreo.message);
    }

    res.status(201).json({ id: resultado[0].id });
  } catch (err) {
    await conexion.rollback();
    next(err);
  } finally {
    conexion.release();
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
  const conexion = await pool.getConnection();
  try {
    const viaje = await obtenerViajeOAutorizar(req.params.id, req.user);
    const { nombre, fecha_inicio, fecha_fin, presupuesto, estado } = req.body;

    if (estado && !ESTADOS_VIAJE_VALIDOS.includes(estado)) {
      throw new AppError('Estado invalido', 400);
    }

    await conexion.beginTransaction();

    await conexion.query(
      `UPDATE viajes SET
        nombre = COALESCE(?, nombre),
        fecha_inicio = COALESCE(?, fecha_inicio),
        fecha_fin = COALESCE(?, fecha_fin),
        presupuesto = COALESCE(?, presupuesto),
        estado = COALESCE(?, estado)
       WHERE id = ?`,
      [nombre || null, fecha_inicio || null, fecha_fin || null, presupuesto ?? null, estado || null, viaje.id]
    );

    // Notifica al operador dueno del viaje solo si algo realmente cambio,
    // para no generar ruido en un PUT que reenvia los mismos valores.
    if (estado && estado !== viaje.estado && estado === ESTADO_VIAJE.COMPLETADO) {
      await crearNotificacion(conexion, {
        usuario_id: viaje.usuario_id,
        tipo: TIPO_NOTIFICACION.VIAJE,
        titulo: `Viaje completado: ${nombre || viaje.nombre}`,
        detalle: 'Tu administrador marco este viaje como completado.',
      });
    } else if (
      (nombre && nombre !== viaje.nombre) ||
      (fecha_inicio && fecha_inicio !== viaje.fecha_inicio) ||
      (fecha_fin && fecha_fin !== viaje.fecha_fin) ||
      (presupuesto !== undefined && presupuesto !== null && Number(presupuesto) !== Number(viaje.presupuesto))
    ) {
      await crearNotificacion(conexion, {
        usuario_id: viaje.usuario_id,
        tipo: TIPO_NOTIFICACION.VIAJE,
        titulo: `Viaje actualizado: ${nombre || viaje.nombre}`,
        detalle: 'Se actualizaron los datos de tu viaje. Revisa el presupuesto y las fechas.',
      });
    }

    await conexion.commit();

    res.json({ mensaje: 'Viaje actualizado' });
  } catch (err) {
    await conexion.rollback();
    next(err);
  } finally {
    conexion.release();
  }
}

module.exports = { crear, listar, obtenerUno, actualizar, obtenerViajeOAutorizar };
