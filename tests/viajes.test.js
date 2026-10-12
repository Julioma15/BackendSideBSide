const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, iniciar, idDe, crearViaje, gastoValido, pool } = require('./helpers');

let tokens;
let operadorId;

const como = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  tokens = await iniciar();
  operadorId = await idDe('operador', tokens.admin);
});
after(() => pool.end());

describe('viajes duplicados', () => {
  test('el mismo viaje dos veces da 409 y solo se guarda uno', async () => {
    const datos = { nombre: 'Duplicado Merida', fecha_inicio: '2026-11-01', fecha_fin: '2026-11-05' };
    await crearViaje(tokens.admin, operadorId, datos);

    const res = await api()
      .post('/api/viajes')
      .set(como(tokens.admin))
      .send({ ...datos, nombre: '  duplicado MERIDA ', usuario_id: operadorId, presupuesto: 100 });
    assert.equal(res.status, 409);

    const lista = await api().get('/api/viajes').set(como(tokens.admin));
    assert.equal(lista.body.filter((v) => v.nombre === 'Duplicado Merida').length, 1);
  });

  // Caso real: 9 clics seguidos crearon 9 viajes iguales en 10 segundos.
  test('varias altas iguales al mismo tiempo solo crean un viaje', async () => {
    const datos = { nombre: 'Doble Clic', usuario_id: operadorId, fecha_inicio: '2026-11-10', fecha_fin: '2026-11-12', presupuesto: 0 };
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => api().post('/api/viajes').set(como(tokens.admin)).send(datos))
    );
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
  });

  test('mismo nombre con otras fechas si se permite', async () => {
    await crearViaje(tokens.admin, operadorId, { nombre: 'Ruta Repetida', fecha_inicio: '2026-12-01', fecha_fin: '2026-12-03' });
    await crearViaje(tokens.admin, operadorId, { nombre: 'Ruta Repetida', fecha_inicio: '2026-12-10', fecha_fin: '2026-12-13' });
  });
});

describe('eliminar viaje', () => {
  test('un viaje sin gastos se elimina y se avisa al operador', async () => {
    const id = await crearViaje(tokens.admin, operadorId, { nombre: 'Por Error' });

    const res = await api().delete(`/api/viajes/${id}`).set(como(tokens.admin));
    assert.equal(res.status, 200);

    const ver = await api().get(`/api/viajes/${id}`).set(como(tokens.admin));
    assert.equal(ver.status, 404);

    const notifs = await api().get('/api/notificaciones').set(como(tokens.operador));
    assert.ok(notifs.body.some((n) => n.titulo === 'Viaje eliminado: Por Error'));
  });

  test('un viaje con gastos (aunque sea borrador) no se elimina', async () => {
    const id = await crearViaje(tokens.admin, operadorId, { nombre: 'Con Gastos' });
    const gasto = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(id, { enviar: false }));
    assert.equal(gasto.status, 201);

    const res = await api().delete(`/api/viajes/${id}`).set(como(tokens.admin));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /cancelarlo/);

    const ver = await api().get(`/api/viajes/${id}`).set(como(tokens.admin));
    assert.equal(ver.status, 200);
  });

  test('el operador no puede eliminar viajes', async () => {
    const id = await crearViaje(tokens.admin, operadorId, { nombre: 'Intocable' });
    const res = await api().delete(`/api/viajes/${id}`).set(como(tokens.operador));
    assert.equal(res.status, 403);
  });
});

describe('cancelar viaje', () => {
  test('cancelado ya no acepta gastos ni cambios y conserva los que tenia', async () => {
    const id = await crearViaje(tokens.admin, operadorId, { nombre: 'A Cancelar' });
    await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(id));

    const cancelar = await api().put(`/api/viajes/${id}`).set(como(tokens.admin)).send({ estado: 'cancelado' });
    assert.equal(cancelar.status, 200);

    const nuevo = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(id));
    assert.equal(nuevo.status, 400);

    const editar = await api().put(`/api/viajes/${id}`).set(como(tokens.admin)).send({ presupuesto: 1 });
    assert.equal(editar.status, 400);

    const gastos = await api().get(`/api/gastos?viaje_id=${id}`).set(como(tokens.admin));
    assert.equal(gastos.body.length, 1);

    const notifs = await api().get('/api/notificaciones').set(como(tokens.operador));
    assert.ok(notifs.body.some((n) => n.titulo === 'Viaje cancelado: A Cancelar'));
  });

  test('un viaje cancelado no cuenta como duplicado', async () => {
    const datos = { nombre: 'Rehacer', fecha_inicio: '2026-11-20', fecha_fin: '2026-11-21' };
    const id = await crearViaje(tokens.admin, operadorId, datos);
    await api().put(`/api/viajes/${id}`).set(como(tokens.admin)).send({ estado: 'cancelado' });
    await crearViaje(tokens.admin, operadorId, datos);
  });
});
