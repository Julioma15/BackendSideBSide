const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, iniciar, pool } = require('./helpers');
const { USUARIOS_PRUEBA } = require('./preparar-db');

let tokens;
before(async () => { tokens = await iniciar(); });
after(() => pool.end());

describe('login', () => {
  test('credenciales correctas regresan token y rol', async () => {
    const { email, contrasena } = USUARIOS_PRUEBA.admin;
    const res = await api().post('/api/auth/login').send({ email, contrasena });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.usuario.rol, 'admin');
    assert.equal(res.body.usuario.contrasena, undefined, 'nunca debe exponer el hash');
  });

  test('contrasena incorrecta da 401 con mensaje especifico', async () => {
    const res = await api().post('/api/auth/login').send({ email: USUARIOS_PRUEBA.admin.email, contrasena: 'NoEsEsta123' });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /contrasena no es correcta/i);
  });

  test('el correo con mayusculas o espacios entra igual (el celular capitaliza)', async () => {
    const { email, contrasena } = USUARIOS_PRUEBA.admin;
    const conMayusculas = `  ${email[0].toUpperCase()}${email.slice(1).toUpperCase()} `;
    const res = await api().post('/api/auth/login').send({ email: conMayusculas, contrasena });
    assert.equal(res.status, 200);
  });

  test('correo inexistente da 404', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nadie@test.local', contrasena: 'Algo12345' });
    assert.equal(res.status, 404);
  });

  test('campos vacios dan 400', async () => {
    const res = await api().post('/api/auth/login').send({});
    assert.equal(res.status, 400);
  });
});

describe('proteccion de rutas', () => {
  test('sin token da 401', async () => {
    const res = await api().get('/api/gastos');
    assert.equal(res.status, 401);
  });

  test('token alterado da 401', async () => {
    const res = await api().get('/api/gastos').set('Authorization', `Bearer ${tokens.admin}x`);
    assert.equal(res.status, 401);
  });

  for (const ruta of ['/api/usuarios', '/api/reportes/totales', '/api/gastos/pendientes']) {
    test(`operador no puede entrar a ${ruta}`, async () => {
      const res = await api().get(ruta).set('Authorization', `Bearer ${tokens.operador}`);
      assert.equal(res.status, 403);
    });
  }

  test('operador no puede registrar usuarios', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokens.operador}`)
      .send({ nombre: 'Intruso', email: 'intruso@test.local', contrasena: 'Intruso12345', rol: 'admin' });
    assert.equal(res.status, 403);
  });
});

describe('usuarios desactivados', () => {
  test('un usuario dado de baja ya no puede iniciar sesion', async () => {
    const lista = await api().get('/api/usuarios').set('Authorization', `Bearer ${tokens.admin}`);
    const op2 = lista.body.find((u) => u.email === USUARIOS_PRUEBA.operador2.email);

    const baja = await api().delete(`/api/usuarios/${op2.id}`).set('Authorization', `Bearer ${tokens.admin}`);
    assert.equal(baja.status, 200);

    const { email, contrasena } = USUARIOS_PRUEBA.operador2;
    const res = await api().post('/api/auth/login').send({ email, contrasena });
    assert.equal(res.status, 403);
  });
});

describe('alta de usuarios por el admin', () => {
  // Caso real: "ada@;ald;a.com" pasaba la validacion, se guardaba y luego
  // nodemailer lo partia en "ada@"; Gmail lo rechazaba, la peticion daba 500
  // y el usuario quedaba creado a medias.
  for (const email of ['ada@;ald;a.com', 'ada@', 'a,b@x.com', 'a@b.c']) {
    test(`rechaza email invalido "${email}" con 400 y no lo guarda`, async () => {
      const res = await api()
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ nombre: 'Prueba Email', email });
      assert.equal(res.status, 400);

      const lista = await api().get('/api/usuarios').set('Authorization', `Bearer ${tokens.admin}`);
      assert.ok(!lista.body.some((u) => u.email === email));
    });
  }

  test('guarda el correo en minusculas y no deja duplicarlo con otras mayusculas', async () => {
    const crear = (email) => api()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ nombre: 'Prueba Mayusculas', email });

    const res = await crear(' Mayus.Prueba@Test.Local ');
    assert.equal(res.status, 201);
    assert.equal(res.body.email, 'mayus.prueba@test.local');

    const repetido = await crear('mayus.prueba@test.local');
    assert.equal(repetido.status, 409);
  });
});
