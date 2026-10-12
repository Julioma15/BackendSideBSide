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

// Produccion: Resend por HTTPS. DigitalOcean bloquea los puertos SMTP
// (25/465/587) en los Droplets, asi que Gmail por SMTP no sale desde el
// servidor; una API HTTP no tiene ese problema y, con el dominio propio
// verificado (SPF/DKIM en Porkbun), los correos llegan como
// no-reply@<dominio> y no caen en spam.
async function enviarConResend({ to, subject, html }) {
  const attachments = tieneLogo()
    ? [{ filename: 'logo-correo.png', content: fs.readFileSync(LOGO_PATH).toString('base64'), content_id: LOGO_CID }]
    : [];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, attachments }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Resend respondio ${res.status}: ${detalle}`);
  }
}

// Orden: Resend (produccion) -> SMTP (desarrollo local con Gmail) -> solo log.
// Si no hay nada configurado (dev sin credenciales, pruebas) no truena el
// flujo completo: solo lo deja en el log para poder probar sin correo real.
async function enviarCorreo({ to, subject, html }) {
  if (process.env.RESEND_API_KEY) {
    return enviarConResend({ to, subject, html });
  }

  const t = getTransporter();
  if (!t) {
    console.warn(`[email] Correo no configurado. NO enviado a ${to}: ${subject}`);
    return;
  }

  await t.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    attachments: tieneLogo() ? [{ filename: 'logo-correo.png', path: LOGO_PATH, cid: LOGO_CID }] : [],
  });
}

module.exports = { enviarCorreo, tieneLogo, LOGO_CID };
