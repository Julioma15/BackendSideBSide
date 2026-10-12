require('dotenv').config();

// La app se define aqui, separada de server.js (que solo hace listen + cron),
// para que las pruebas (tests/) la importen con supertest sin abrir un
// puerto ni programar los recordatorios diarios.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const gastosRoutes = require('./routes/gastos.routes');
const reportesRoutes = require('./routes/reportes.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const viajesRoutes = require('./routes/viajes.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');

const app = express();

// En produccion la app corre detras de Caddy (proxy inverso con HTTPS), asi
// que la IP del cliente llega en X-Forwarded-For. Sin esto, express-rate-limit
// ve a TODOS los usuarios con la IP del proxy: 10 contrasenas mal escritas
// entre todos bloquearian el login de la empresa entera. Va por variable y no
// fija porque sin proxy delante (desarrollo) confiar en ese header dejaria a
// cualquiera falsear su IP y saltarse los limites.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

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

module.exports = app;
