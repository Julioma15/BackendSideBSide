// Deja la base de pruebas en un estado conocido: la crea si no existe, borra
// todo, aplica sql/schema.sql (que ya incluye todas las migraciones) y
// siembra un admin y un operador con contrasenas fijas.
//
// Lo usan las pruebas de API (tests/*.test.js) y las E2E de Playwright del
// frontend, que lo corren por linea de comandos antes de levantar el backend:
//   node tests/preparar-db.js

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const USUARIOS_PRUEBA = {
  admin: { nombre: 'Admin Pruebas', email: 'admin@test.local', contrasena: 'Admin12345', rol: 'admin' },
  operador: { nombre: 'Operador Pruebas', email: 'operador@test.local', contrasena: 'Operador12345', rol: 'operador' },
  operador2: { nombre: 'Otro Operador', email: 'operador2@test.local', contrasena: 'Operador12345', rol: 'operador' },
};

function configCliente(database) {
  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

async function prepararDb() {
  const nombreDb = process.env.DB_NAME;
  // Candado: este script hace DROP SCHEMA. Si por error se corre con el .env
  // de desarrollo (DB_NAME=sidebside), se niega en vez de borrar datos reales.
  if (!nombreDb || !nombreDb.endsWith('_test')) {
    throw new Error(`La base de pruebas debe terminar en "_test" (se recibio "${nombreDb}")`);
  }

  const admin = new Client(configCliente('postgres'));
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreDb]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${nombreDb}"`);
  }
  await admin.end();

  const db = new Client(configCliente(nombreDb));
  await db.connect();
  try {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await db.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8'));

    for (const u of Object.values(USUARIOS_PRUEBA)) {
      const hash = await bcrypt.hash(u.contrasena, 4); // costo bajo: solo pruebas
      await db.query(
        'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES ($1, $2, $3, $4)',
        [u.nombre, u.email, hash, u.rol]
      );
    }
  } finally {
    await db.end();
  }
}

module.exports = { prepararDb, USUARIOS_PRUEBA };

if (require.main === module) {
  require('./entorno');
  prepararDb()
    .then(() => console.log(`Base ${process.env.DB_NAME} lista`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
