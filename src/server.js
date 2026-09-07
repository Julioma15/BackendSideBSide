require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { verificarConexion } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const gastosRoutes = require('./routes/gastos.routes');
const reportesRoutes = require('./routes/reportes.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const viajesRoutes = require('./routes/viajes.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Los comprobantes NO se sirven como estaticos: son documentos fiscales con
// montos y datos de empleados. Se entregan por GET /api/gastos/:id/comprobante,
// que valida token y propiedad del gasto.

app.use('/api/auth', authRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/usuarios', usuariosRoutes);

app.get('/api/health', (req, res) => res.json({ estado: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function iniciar() {
  try {
    await verificarConexion();
    console.log('Conexion a PostgreSQL exitosa');
    app.listen(PORT, () => console.log(`Servidor SideBSide escuchando en puerto ${PORT}`));
  } catch (err) {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
    process.exit(1);
  }
}

iniciar();
