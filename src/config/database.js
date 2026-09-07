const { Pool, types } = require('pg');

// pg devuelve NUMERIC/DECIMAL (monto, presupuesto) y BIGINT (COUNT(*) en
// reportes) como string por defecto, para no perder precision. El front hace
// aritmetica y .toFixed() sobre esos campos, asi que se convierten a number
// aqui, una sola vez, para toda la app. Los montos nunca llegan a superar
// Number.MAX_SAFE_INTEGER en este dominio, asi que parseInt es seguro.
types.setTypeParser(1700, (val) => parseFloat(val)); // numeric/decimal
types.setTypeParser(20, (val) => parseInt(val, 10)); // int8/bigint (COUNT)

// gastos.fecha es DATE a proposito (ver comentario en sql/schema.sql): es la
// fecha del gasto segun el negocio, no un instante. El parser por defecto de
// pg convierte DATE a un objeto Date de JS, que luego JSON.stringify serializa
// con hora y zona ("2026-08-21T06:00:00.000Z") — exactamente lo que ese
// comentario dice que hay que evitar. El texto crudo que manda Postgres ya es
// "YYYY-MM-DD", asi que se devuelve tal cual.
types.setTypeParser(1082, (val) => val); // date

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
