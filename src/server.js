require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const { verificarConexion } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { enviarRecordatoriosViajes } = require('./utils/recordatoriosViajes');

const authRoutes = require('./routes/auth.routes');
const gastosRoutes = require('./routes/gastos.routes');
const reportesRoutes = require('./routes/reportes.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const viajesRoutes = require('./routes/viajes.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');

const app = express();

// crossOriginResourcePolicy 'cross-origin': el frontend (otro origen) carga
// comprobantes/facturas como <img>/blob directo de la API; el default de
// helmet ('same-origin') los bloquearia con un 403 silencioso en el browser.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// Limite general de requests por IP, ademas de los limites especificos de
// login/recuperacion en auth.routes.js: cubre el resto de la API (evita que
// un solo cliente abuse de /gastos, /reportes, etc.) sin estorbar el uso
// normal de la app (300 req / 5 min es generoso para una pyme).
app.use('/api', rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Los comprobantes NO se sirven como estaticos: son documentos fiscales con
// montos y datos de empleados. Se entregan por GET /api/gastos/:id/comprobante,
// que valida token y propiedad del gasto.

app.use('/api/auth', authRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

app.get('/api/health', (req, res) => res.json({ estado: 'ok' }));

app.use(errorHandler);

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
