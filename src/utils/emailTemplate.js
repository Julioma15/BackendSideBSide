// Envoltorio visual comun para todos los correos transaccionales (cuenta
// nueva, recuperar contrasena, etc.). Estilos inline a proposito: la mayoria
// de clientes de correo (Gmail, Outlook) ignoran o recortan <style> en el
// <head>, asi que lo unico confiable es style="" en cada elemento. Los
// colores/badge replican exactamente el header de Login.jsx (bg-blue-500 +
// #1a2456) para que se vea como la misma marca en la app y en el correo.

const { tieneLogo, LOGO_CID } = require('./email');

function plantillaCorreo({ titulo, cuerpoHtml }) {
  // El banner real (cuando exista logo-correo.png) va como adjunto CID en el
  // pie, no en el header: asi el header siempre se ve bien (badge "S" via
  // CSS) sin depender de que el archivo ya este listo. Es una franja ancha
  // (600x100) con su propio fondo solido, asi que va a todo lo ancho de la
  // tarjeta (sin el padding lateral del resto del pie) para que se vea como
  // un banner, no como una imagen encogida flotando en una esquina.
  const pieLogo = tieneLogo()
    ? `<img src="cid:${LOGO_CID}" alt="SideBSide — La forma más fácil de registrar tus viajes" width="480" style="display:block;width:100%;max-width:480px;height:auto;" />`
    : '';

  return `
  <div style="background-color:#f3f4f6;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#1a2456,#2a3a8f);padding:32px 24px;text-align:center;">
        <table role="presentation" align="center" style="margin:0 auto 10px;">
          <tr>
            <td style="width:40px;height:40px;border-radius:50%;background-color:#3b82f6;color:#ffffff;font-weight:bold;font-size:18px;text-align:center;vertical-align:middle;">S</td>
            <td style="padding-left:12px;color:#ffffff;font-size:22px;font-weight:bold;">SideBSide</td>
          </tr>
        </table>
        <p style="margin:0;color:#bfdbfe;font-size:13px;letter-spacing:0.3px;">Gestión de gastos operativos</p>
      </div>
      <div style="padding:32px 28px;color:#374151;font-size:14px;line-height:1.65;">
        <h1 style="margin:0 0 18px;color:#1a2456;font-size:19px;">${titulo}</h1>
        ${cuerpoHtml}
      </div>
      <div style="background-color:#f9fafb;border-top:1px solid #f0f0f0;">
        ${pieLogo}
        <p style="margin:0;padding:16px 24px 20px;color:#9ca3af;font-size:12px;text-align:center;">Este es un correo automático de SideBSide. No respondas a este mensaje.</p>
      </div>
    </div>
  </div>`;
}

module.exports = { plantillaCorreo };
