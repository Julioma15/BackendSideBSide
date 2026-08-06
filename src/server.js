require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { verificarConexion } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const gastosRoutes = require('./routes/gastos.routes');
const reportesRoutes = require('./routes/reportes.routes');
const categoriasRoutes = require('./routes/categorias.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/categorias', categoriasRoutes);

app.get('/api/health', (req, res) => res.json({ estado: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function iniciar() {
  try {
    await verificarConexion();
    console.log('Conexion a MySQL exitosa');
    app.listen(PORT, () => console.log(`Servidor SideBSide escuchando en puerto ${PORT}`));
  } catch (err) {
    console.error('No se pudo conectar a MySQL:', err.message);
    process.exit(1);
  }
}

iniciar();
