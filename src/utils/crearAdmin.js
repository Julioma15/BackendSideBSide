// Script de un solo uso para crear el primer administrador (no hay otro admin
// autenticado todavia que pueda usar POST /api/auth/register).
// Uso: node src/utils/crearAdmin.js "Nombre Admin" admin@empresa.mx contrasena123

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { ROL } = require('../constants');
const { normalizarEmail } = require('./validations');

async function main() {
  const [nombre, emailCrudo, contrasena] = process.argv.slice(2);
  const email = normalizarEmail(emailCrudo);

  if (!nombre || !email || !contrasena) {
    console.error('Uso: node src/utils/crearAdmin.js "Nombre Admin" admin@empresa.mx contrasena123');
    process.exit(1);
  }

  const hash = await bcrypt.hash(contrasena, 10);
  await pool.query(
    'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
    [nombre, email, hash, ROL.ADMIN]
  );

  console.log(`Admin creado: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
