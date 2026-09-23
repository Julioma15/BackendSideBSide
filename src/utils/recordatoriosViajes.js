// Recordatorios diarios por correo para el operador dueno de un viaje: uno
// el dia que el viaje empieza y otro el dia que termina. La comparacion de
// fecha se hace en SQL (= CURRENT_DATE) para no depender de como Node
// interprete zonas horarias al comparar strings 'YYYY-MM-DD' en JS.

const { pool } = require('../config/database');
const { ESTADO_VIAJE } = require('../constants');
const { enviarCorreo } = require('./email');
const { plantillaCorreo } = require('./emailTemplate');

async function viajesQueEmpiezanHoy() {
  const [filas] = await pool.query(
    `SELECT v.id, v.nombre, v.fecha_inicio, v.fecha_fin, u.nombre AS operador_nombre, u.email AS operador_email
     FROM viajes v JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.estado = ? AND v.fecha_inicio = CURRENT_DATE`,
    [ESTADO_VIAJE.ACTIVO]
  );
  return filas;
}

async function viajesQueTerminanHoy() {
  const [filas] = await pool.query(
    `SELECT v.id, v.nombre, v.fecha_inicio, v.fecha_fin, u.nombre AS operador_nombre, u.email AS operador_email
     FROM viajes v JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.estado = ? AND v.fecha_fin = CURRENT_DATE`,
    [ESTADO_VIAJE.ACTIVO]
  );
  return filas;
}

async function enviarRecordatorioInicio(viaje) {
  await enviarCorreo({
    to: viaje.operador_email,
    subject: `Tu viaje "${viaje.nombre}" inicia hoy`,
    html: plantillaCorreo({
      titulo: 'Tu viaje inicia hoy 🚗',
      cuerpoHtml: `
        <p style="margin:0 0 16px;">Hola ${viaje.operador_nombre.split(' ')[0]},</p>
        <p style="margin:0 0 20px;">Hoy arranca tu viaje <strong>${viaje.nombre}</strong> (${viaje.fecha_inicio} → ${viaje.fecha_fin}). No olvides registrar tus gastos en la plataforma conforme los vayas teniendo, así no se te juntan al final.</p>
        <p style="margin:0 0 20px;text-align:center;">
          <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Registrar gasto</a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Buen viaje.</p>
      `,
    }),
  });
}

async function enviarRecordatorioFin(viaje) {
  await enviarCorreo({
    to: viaje.operador_email,
    subject: `Tu viaje "${viaje.nombre}" termina hoy`,
    html: plantillaCorreo({
      titulo: 'Tu viaje termina hoy ✅',
      cuerpoHtml: `
        <p style="margin:0 0 16px;">Hola ${viaje.operador_nombre.split(' ')[0]},</p>
        <p style="margin:0 0 20px;">Hoy es el último día de tu viaje <strong>${viaje.nombre}</strong>. Recuerda terminar de registrar todos tus gastos pendientes antes de que se cierre, para que tu administrador pueda revisarlos a tiempo.</p>
        <p style="margin:0 0 20px;text-align:center;">
          <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Registrar gasto</a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Gracias por mantener tus gastos al día.</p>
      `,
    }),
  });
}

// Cada correo va en su propio try/catch: si uno falla (SMTP, correo
// invalido, etc.) no debe tumbar el resto del lote del dia.
async function enviarRecordatoriosViajes() {
  const [inician, terminan] = await Promise.all([viajesQueEmpiezanHoy(), viajesQueTerminanHoy()]);

  for (const viaje of inician) {
    try {
      await enviarRecordatorioInicio(viaje);
    } catch (err) {
      console.warn(`[email] No se pudo enviar recordatorio de inicio (viaje ${viaje.id}) a ${viaje.operador_email}:`, err.message);
    }
  }

  for (const viaje of terminan) {
    try {
      await enviarRecordatorioFin(viaje);
    } catch (err) {
      console.warn(`[email] No se pudo enviar recordatorio de fin (viaje ${viaje.id}) a ${viaje.operador_email}:`, err.message);
    }
  }

  return { inician: inician.length, terminan: terminan.length };
}

module.exports = { enviarRecordatoriosViajes };
