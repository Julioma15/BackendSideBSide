const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, iniciar, idDe, crearViaje, gastoValido, pool } = require('./helpers');

let tokens;
let viajeOperador;
let viajeOperador2;

const como = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  tokens = await iniciar();
  viajeOperador = await crearViaje(tokens.admin, await idDe('operador', tokens.admin));
  viajeOperador2 = await crearViaje(tokens.admin, await idDe('operador2', tokens.admin));
});
after(() => pool.end());

describe('crear gasto', () => {
  test('gasto valido queda pendiente', async () => {
    const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador));
    assert.equal(res.status, 201);
    assert.equal(res.body.estado, 'pendiente');
  });

  test('sin enviar queda como borrador', async () => {
    const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, { enviar: false }));
    assert.equal(res.status, 201);
    assert.equal(res.body.estado, 'borrador');
  });

  const invalidos = [
    ['monto 0', { monto: 0 }],
    ['monto negativo', { monto: -10 }],
    ['sin categoria', { categoria_id: undefined }],
    ['fecha invalida', { fecha: 'ayer' }],
    ['moneda no soportada', { moneda: 'BTC' }],
    ['IVA mayor al monto', { monto: 100, iva: 150 }],
    ['IVA negativo', { iva: -1 }],
  ];
  for (const [caso, cambio] of invalidos) {
    test(`rechaza ${caso} con 400`, async () => {
      const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, cambio));
      assert.equal(res.status, 400, JSON.stringify(res.body));
    });
  }

  // El viaje de prueba va del 2026-10-01 al 2026-10-05 (helpers.crearViaje).
  for (const fecha of ['2026-09-30', '2026-10-06']) {
    test(`rechaza fecha ${fecha} fuera del viaje con 400`, async () => {
      const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, { fecha }));
      assert.equal(res.status, 400);
      assert.match(res.body.error, /dentro del viaje/);
    });
  }

  test('acepta los dias de inicio y fin del viaje', async () => {
    for (const fecha of ['2026-10-01', '2026-10-05']) {
      const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, { fecha }));
      assert.equal(res.status, 201, fecha);
    }
  });

  test('un viaje que aun no empieza acepta gastos con fecha dentro del viaje (pago adelantado)', async () => {
    const futuro = await crearViaje(tokens.admin, await idDe('operador', tokens.admin), {
      nombre: 'Viaje Futuro', fecha_inicio: '2030-01-10', fecha_fin: '2030-01-12',
    });
    const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(futuro, { fecha: '2030-01-10' }));
    assert.equal(res.status, 201);
  });

  test('editar un gasto no puede sacar su fecha del viaje', async () => {
    const creado = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, { enviar: false }));
    const res = await api().put(`/api/gastos/${creado.body.id}`).set(como(tokens.operador)).send({ fecha: '2026-12-25' });
    assert.equal(res.status, 400);
  });

  test('operador no puede cargar gastos al viaje de otro', async () => {
    const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador2));
    assert.equal(res.status, 403);
  });
});

describe('tipos que regresa la API', () => {
  // Regresion de los bugs de pg encontrados el 2026-08-23: NUMERIC llegaba
  // como string y DATE como datetime ISO con zona (ver src/config/database.js).
  test('monto/iva son numeros y fecha es YYYY-MM-DD', async () => {
    const res = await api().get('/api/gastos').set(como(tokens.operador));
    assert.equal(res.status, 200);
    const gasto = res.body[0];
    assert.equal(typeof gasto.monto, 'number');
    assert.equal(typeof gasto.iva, 'number');
    assert.match(gasto.fecha, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('presupuesto del viaje es numero', async () => {
    const res = await api().get(`/api/viajes/${viajeOperador}`).set(como(tokens.operador));
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.presupuesto, 'number');
  });
});

describe('aislamiento entre operadores', () => {
  let gastoDeOperador;

  before(async () => {
    const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, { descripcion: 'privado' }));
    gastoDeOperador = res.body.id;
  });

  test('otro operador no ve el gasto en su lista', async () => {
    const res = await api().get('/api/gastos').set(como(tokens.operador2));
    assert.ok(!res.body.some((g) => g.id === gastoDeOperador));
  });

  test('otro operador no puede abrirlo, editarlo ni borrarlo', async () => {
    assert.equal((await api().get(`/api/gastos/${gastoDeOperador}`).set(como(tokens.operador2))).status, 403);
    assert.equal((await api().put(`/api/gastos/${gastoDeOperador}`).set(como(tokens.operador2)).send({ monto: 1 })).status, 403);
    assert.equal((await api().delete(`/api/gastos/${gastoDeOperador}`).set(como(tokens.operador2))).status, 403);
  });

  test('otro operador no puede ver el viaje ajeno', async () => {
    const res = await api().get(`/api/viajes/${viajeOperador}`).set(como(tokens.operador2));
    assert.equal(res.status, 403);
  });
});

describe('flujo de aprobacion', () => {
  async function nuevoPendiente(extra) {
    const res = await api().post('/api/gastos').set(como(tokens.operador)).send(gastoValido(viajeOperador, extra));
    return res.body.id;
  }

  test('crear un gasto pendiente notifica al admin', async () => {
    await nuevoPendiente({ descripcion: 'Casetas Kantunil' });
    const res = await api().get('/api/notificaciones').set(como(tokens.admin));
    assert.ok(res.body.some((n) => n.tipo === 'pendiente' && n.detalle.includes('Casetas Kantunil')));
  });

  test('aprobar cambia el estado y notifica al operador', async () => {
    const id = await nuevoPendiente({ descripcion: 'Para aprobar' });

    const res = await api().put(`/api/gastos/${id}/aprobar`).set(como(tokens.admin)).send({});
    assert.equal(res.status, 200);

    const gasto = await api().get(`/api/gastos/${id}`).set(como(tokens.operador));
    assert.equal(gasto.body.estado, 'aprobado');

    const notifs = await api().get('/api/notificaciones').set(como(tokens.operador));
    assert.ok(notifs.body.some((n) => n.tipo === 'aprobado' && n.detalle === 'Para aprobar'));
  });

  test('no se puede aprobar dos veces', async () => {
    const id = await nuevoPendiente();
    await api().put(`/api/gastos/${id}/aprobar`).set(como(tokens.admin)).send({});
    const res = await api().put(`/api/gastos/${id}/aprobar`).set(como(tokens.admin)).send({});
    assert.equal(res.status, 400);
  });

  test('rechazar sin comentario da 400 y el gasto sigue pendiente', async () => {
    const id = await nuevoPendiente();
    const res = await api().put(`/api/gastos/${id}/rechazar`).set(como(tokens.admin)).send({ comentario: '  ' });
    assert.equal(res.status, 400);

    const gasto = await api().get(`/api/gastos/${id}`).set(como(tokens.admin));
    assert.equal(gasto.body.estado, 'pendiente');
  });

  test('rechazar con comentario guarda el motivo visible para el operador', async () => {
    const id = await nuevoPendiente();
    const res = await api().put(`/api/gastos/${id}/rechazar`).set(como(tokens.admin)).send({ comentario: 'Falta el ticket' });
    assert.equal(res.status, 200);

    const gasto = await api().get(`/api/gastos/${id}`).set(como(tokens.operador));
    assert.equal(gasto.body.estado, 'rechazado');
    assert.equal(gasto.body.comentario, 'Falta el ticket');
  });

  test('un gasto aprobado ya no se puede editar ni borrar', async () => {
    const id = await nuevoPendiente();
    await api().put(`/api/gastos/${id}/aprobar`).set(como(tokens.admin)).send({});

    assert.equal((await api().put(`/api/gastos/${id}`).set(como(tokens.operador)).send({ monto: 1 })).status, 400);
    assert.equal((await api().delete(`/api/gastos/${id}`).set(como(tokens.operador))).status, 400);
  });

  test('un borrador no se puede aprobar', async () => {
    const id = await nuevoPendiente({ enviar: false });
    const res = await api().put(`/api/gastos/${id}/aprobar`).set(como(tokens.admin)).send({});
    assert.equal(res.status, 400);
  });
});

describe('reportes', () => {
  test('totales suman y regresan numeros', async () => {
    const res = await api().get('/api/reportes/totales').set(como(tokens.admin));
    assert.equal(res.status, 200);
    for (const [campo, valor] of Object.entries(res.body)) {
      assert.equal(typeof valor, 'number', `${campo} deberia ser number, llego ${JSON.stringify(valor)}`);
    }
  });
});
