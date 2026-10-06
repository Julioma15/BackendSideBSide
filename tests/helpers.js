const request = require('supertest');
const app = require('../src/app');
const { prepararDb, USUARIOS_PRUEBA } = require('./preparar-db');

const api = () => request(app);

async function login(clave) {
  const { email, contrasena } = USUARIOS_PRUEBA[clave];
  const res = await api().post('/api/auth/login').send({ email, contrasena });
  if (res.status !== 200) {
    throw new Error(`Login de ${email} fallo (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

// Base limpia + tokens de los tres usuarios sembrados. Cada archivo de
// pruebas la llama en su before() para no depender del orden ni de lo que
// dejo otro archivo.
async function iniciar() {
  await prepararDb();
  return {
    admin: await login('admin'),
    operador: await login('operador'),
    operador2: await login('operador2'),
  };
}

async function idDe(clave, tokenAdmin) {
  const res = await api().get('/api/usuarios').set('Authorization', `Bearer ${tokenAdmin}`);
  return res.body.find((u) => u.email === USUARIOS_PRUEBA[clave].email).id;
}

async function crearViaje(tokenAdmin, usuarioId, extra = {}) {
  const res = await api()
    .post('/api/viajes')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({
      nombre: 'Ruta Merida - Cancun',
      usuario_id: usuarioId,
      fecha_inicio: '2026-10-01',
      fecha_fin: '2026-10-05',
      presupuesto: 5000,
      ...extra,
    });
  if (res.status !== 201) throw new Error(`No se pudo crear el viaje: ${JSON.stringify(res.body)}`);
  return res.body.id;
}

function gastoValido(viajeId, extra = {}) {
  return {
    monto: 850.5,
    iva: 117.31,
    categoria_id: 1,
    fecha: '2026-10-02',
    viaje_id: viajeId,
    descripcion: 'Gasolina Pemex',
    enviar: true,
    ...extra,
  };
}

module.exports = { api, iniciar, login, idDe, crearViaje, gastoValido, pool: require('../src/config/database').pool };
