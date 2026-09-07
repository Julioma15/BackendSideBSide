const { pool } = require('../config/database');

function filtrosPeriodo(query) {
  const condiciones = [];
  const params = [];

  if (query.fecha_desde) {
    condiciones.push('g.fecha >= ?');
    params.push(query.fecha_desde);
  }
  if (query.fecha_hasta) {
    condiciones.push('g.fecha <= ?');
    params.push(query.fecha_hasta);
  }
  if (query.usuario_id) {
    condiciones.push('g.usuario_id = ?');
    params.push(query.usuario_id);
  }

  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
}

async function totales(req, res, next) {
  try {
    const { where, params } = filtrosPeriodo(req.query);
    const [filas] = await pool.query(
      `SELECT
         COUNT(*) AS cantidad_gastos,
         COALESCE(SUM(monto), 0) AS monto_total,
         SUM(CASE WHEN estado = 'aprobado' THEN 1 ELSE 0 END) AS aprobados,
         SUM(CASE WHEN estado = 'rechazado' THEN 1 ELSE 0 END) AS rechazados,
         SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
         COALESCE(SUM(CASE WHEN estado = 'aprobado' THEN monto ELSE 0 END), 0) AS monto_aprobado,
         COALESCE(SUM(CASE WHEN estado = 'rechazado' THEN monto ELSE 0 END), 0) AS monto_rechazado,
         COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN monto ELSE 0 END), 0) AS monto_pendiente
       FROM gastos g
       ${where}`,
      params
    );

    const fila = filas[0];
    const totalRevisados = Number(fila.aprobados) + Number(fila.rechazados);
    const tasaAprobacion = totalRevisados > 0 ? Number(fila.aprobados) / totalRevisados : 0;

    res.json({ ...fila, tasa_aprobacion: Number(tasaAprobacion.toFixed(4)) });
  } catch (err) {
    next(err);
  }
}

async function porCategoria(req, res, next) {
  try {
    const { where, params } = filtrosPeriodo(req.query);
    const [filas] = await pool.query(
      `SELECT c.nombre AS categoria, COUNT(*) AS cantidad, COALESCE(SUM(g.monto), 0) AS monto_total
       FROM gastos g
       JOIN categorias c ON c.id = g.categoria_id
       ${where}
       GROUP BY c.id, c.nombre
       ORDER BY monto_total DESC`,
      params
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function porEmpleado(req, res, next) {
  try {
    const { where, params } = filtrosPeriodo(req.query);
    const [filas] = await pool.query(
      `SELECT u.id AS usuario_id, u.nombre AS empleado, COUNT(*) AS cantidad, COALESCE(SUM(g.monto), 0) AS monto_total
       FROM gastos g
       JOIN usuarios u ON u.id = g.usuario_id
       ${where}
       GROUP BY u.id, u.nombre
       ORDER BY monto_total DESC`,
      params
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function porMes(req, res, next) {
  try {
    const { where, params } = filtrosPeriodo(req.query);
    const [filas] = await pool.query(
      `SELECT to_char(date_trunc('month', g.fecha), 'YYYY-MM') AS mes,
              COUNT(*) AS cantidad, COALESCE(SUM(g.monto), 0) AS monto_total
       FROM gastos g
       ${where}
       GROUP BY date_trunc('month', g.fecha)
       ORDER BY date_trunc('month', g.fecha)`,
      params
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function general(req, res, next) {
  try {
    const { where, params } = filtrosPeriodo(req.query);
    const [filas] = await pool.query(
      `SELECT g.id, g.monto, g.estado, g.fecha, c.nombre AS categoria, u.nombre AS empleado
       FROM gastos g
       JOIN categorias c ON c.id = g.categoria_id
       JOIN usuarios u ON u.id = g.usuario_id
       ${where}
       ORDER BY g.fecha DESC`,
      params
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

module.exports = { totales, porCategoria, porEmpleado, porMes, general };
