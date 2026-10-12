const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { enviarCorreo, tieneLogo } = require('../src/utils/email');

// fetch simulado: verifica lo que se le mandaria a Resend sin mandar nada.
beforeEach(() => {
  process.env.RESEND_API_KEY = 're_prueba';
  process.env.EMAIL_FROM = 'SideBSide <no-reply@test.local>';
});
afterEach(() => {
  process.env.RESEND_API_KEY = '';
  mock.restoreAll();
});

test('con RESEND_API_KEY manda el correo por la API de Resend', async () => {
  const fetchFalso = mock.method(global, 'fetch', async () => new Response('{"id":"abc"}', { status: 200 }));

  await enviarCorreo({ to: 'operador@test.local', subject: 'Hola', html: '<p>Hola</p>' });

  assert.equal(fetchFalso.mock.callCount(), 1);
  const [url, opciones] = fetchFalso.mock.calls[0].arguments;
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(opciones.headers.Authorization, 'Bearer re_prueba');
  const cuerpo = JSON.parse(opciones.body);
  assert.equal(cuerpo.from, 'SideBSide <no-reply@test.local>');
  assert.equal(cuerpo.to, 'operador@test.local');
  if (tieneLogo()) {
    assert.equal(cuerpo.attachments[0].content_id, 'logo-sidebside', 'el logo va inline para cid: en la plantilla');
  }
});

test('si Resend responde error, enviarCorreo lanza (no falla en silencio)', async () => {
  mock.method(global, 'fetch', async () => new Response('{"message":"dominio no verificado"}', { status: 403 }));

  await assert.rejects(
    enviarCorreo({ to: 'operador@test.local', subject: 'Hola', html: '<p>Hola</p>' }),
    /403.*dominio no verificado/
  );
});
