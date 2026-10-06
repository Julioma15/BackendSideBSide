require('dotenv').config();
const cron = require('node-cron');

const app = require('./app');
const { verificarConexion } = require('./config/database');
const { enviarRecordatoriosViajes } = require('./utils/recordatoriosViajes');

const PORT = process.env.PORT || 5000;

// Recordatorios de "tu viaje inicia/termina hoy": una vez al dia, 8am hora
// de Mexico. Corre adentro del propio proceso (no necesita un cron externo
// ni un servicio aparte) mientras el servidor este arriba.
function programarRecordatorios() {
  cron.schedule('0 8 * * *', () => {
    enviarRecordatoriosViajes()
      .then(({ inician, terminan }) => console.log(`[recordatorios] enviados: ${inician} de inicio, ${terminan} de fin`))
      .catch(err => console.error('[recordatorios] fallo el lote diario:', err.message));
  }, { timezone: 'America/Mexico_City' });
}

async function iniciar() {
  try {
    await verificarConexion();
    console.log('Conexion a PostgreSQL exitosa');
    programarRecordatorios();
    app.listen(PORT, () => console.log(`Servidor SideBSide escuchando en puerto ${PORT}`));
  } catch (err) {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
    process.exit(1);
  }
}

iniciar();
