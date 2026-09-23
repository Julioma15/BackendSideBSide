const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

let transporter = null;

// Logo del pie de los correos: se incrusta como adjunto CID (no como URL
// publica) para que se vea igual aunque el sitio todavia no este
// desplegado. Si el archivo no existe todavia (nadie lo ha puesto), los
// correos simplemente salen sin logo en vez de con una imagen rota.
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-correo.png');
const LOGO_CID = 'logo-sidebside';
function tieneLogo() {
  return fs.existsSync(LOGO_PATH);
}

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// Si no hay SMTP configurado (dev sin credenciales todavia), no truena el
// flujo completo: solo lo deja en el log para que se pueda probar sin correo
// real. En produccion SMTP_HOST/USER/PASS son obligatorias.
async function enviarCorreo({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP no configurado. Correo NO enviado a ${to}: ${subject}`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    attachments: tieneLogo() ? [{ filename: 'logo-correo.png', path: LOGO_PATH, cid: LOGO_CID }] : [],
  });
}

module.exports = { enviarCorreo, tieneLogo, LOGO_CID };
