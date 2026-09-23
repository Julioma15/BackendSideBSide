const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

async function listar(req, res, next) {
  try {
    const [filas] = await pool.query(
      `SELECT id, tipo, titulo, detalle, leido, fecha_creacion
       FROM notificaciones
       WHERE usuario_id = ?
       ORDER BY fecha_creacion DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function marcarLeida(req, res, next) {
  try {
    const [resultado] = await pool.query(
      'UPDATE notificaciones SET leido = true WHERE id = ? AND usuario_id = ? RETURNING id',
      [req.params.id, req.user.id]
    );
    if (resultado.length === 0) {
      throw new AppError('Notificacion no encontrada', 404);
    }
    res.json({ mensaje: 'Notificacion marcada como leida' });
  } catch (err) {
    next(err);
  }
}

async function marcarTodasLeidas(req, res, next) {
  try {
    await pool.query('UPDATE notificaciones SET leido = true WHERE usuario_id = ? AND leido = false', [req.user.id]);
    res.json({ mensaje: 'Notificaciones marcadas como leidas' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, marcarLeida, marcarTodasLeidas };
