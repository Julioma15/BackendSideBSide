const { Pool } = require('pg');

const poolPg = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
});

// Los controllers usan placeholders estilo mysql2 (`?`). Se traducen a `$1, $2...`
// para no tener que reescribir cada query al migrar de MySQL a Postgres.
function aPlaceholdersPg(sql) {
  let contador = 0;
  return sql.replace(/\?/g, () => `$${++contador}`);
}

async function query(sql, params = []) {
  const resultado = await poolPg.query(aPlaceholdersPg(sql), params);
  return [resultado.rows];
}

async function getConnection() {
  const cliente = await poolPg.connect();
  return {
    query: async (sql, params = []) => {
      const resultado = await cliente.query(aPlaceholdersPg(sql), params);
      return [resultado.rows];
    },
    beginTransaction: () => cliente.query('BEGIN'),
    commit: () => cliente.query('COMMIT'),
    rollback: () => cliente.query('ROLLBACK'),
    release: () => cliente.release(),
  };
}

async function verificarConexion() {
  const cliente = await poolPg.connect();
  await cliente.query('SELECT 1');
  cliente.release();
}

const pool = { query, getConnection };

module.exports = { pool, verificarConexion };
