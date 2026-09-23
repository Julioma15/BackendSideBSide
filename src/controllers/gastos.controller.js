const path = require('path');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { validarGasto } = require('../utils/validations');
const { ESTADO_GASTO, ROL, ESTADOS_EDITABLES, TIPO_NOTIFICACION } = require('../constants');
const { crearNotificacionAdmins } = require('../utils/notificaciones');
const { extraerDatosRecibo, ErrorExtraccion } = require('../utils/extraerRecibo');

// Vista previa: no crea nada, no toca disco. El operador sube la foto del
// ticket antes de llenar el formulario y esto regresa datos sugeridos para
// prellenarlo -- el usuario los revisa y confirma al enviar el gasto real.
async function extraerRecibo(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No se recibio ningun archivo', 400);
    }

    const [categorias] = await pool.query(
      "SELECT nombre FROM categorias WHERE estado = 'activo' ORDER BY nombre"
    );
    const nombresCategorias = categorias.map((c) => c.nombre);

    const datos = await extraerDatosRecibo(req.file.buffer, req.file.mimetype, nombresCategorias);
    res.json(datos);
  } catch (err) {
    // Un fallo de Gemini nunca debe tumbar el formulario (el operador
    // siempre puede llenarlo a mano), pero si hay que decirle que fallo y
    // por que: regresar un resultado vacio con 200 se veia igual que "no se
    // pudo leer el ticket" y el usuario no sabia que podia reintentar.
    if (err instanceof ErrorExtraccion) {
      console.warn(`[extraer-recibo] ${err.codigo}:`, err.message);
      const respuestas = {
        saturado: [503, 'El servicio de IA esta saturado en este momento. Intenta de nuevo en unos segundos.'],
        cuota: [429, 'Se alcanzo el limite de lecturas con IA por ahora. Espera un minuto o completa el formulario a mano.'],
        sin_config: [503, 'La lectura con IA no esta disponible en este servidor.'],
      };
      const [status, mensaje] = respuestas[err.codigo];
      return next(new AppError(mensaje, status));
    }
    if (err instanceof AppError) return next(err);
    console.warn('[extraer-recibo] fallo inesperado:', err.message);
    next(new AppError('No se pudo leer el ticket automaticamente. Completa el formulario a mano.', 502));
  }
}

async function crear(req, res, next) {
  const conexion = await pool.getConnection();
  try {
    validarGasto(req.body);
    const { monto, categoria_id, descripcion, fecha, enviar, viaje_id, moneda, ubicacion, iva } = req.body;
    const estado = enviar ? ESTADO_GASTO.PENDIENTE : ESTADO_GASTO.BORRADOR;

    const [viajes] = await pool.query('SELECT usuario_id FROM viajes WHERE id = ?', [viaje_id]);
    const viaje = viajes[0];
    if (!viaje) {
      throw new AppError('El viaje no existe', 404);
    }
    if (req.user.rol !== ROL.ADMIN && viaje.usuario_id !== req.user.id) {
      throw new AppError('No tienes permiso sobre ese viaje', 403);
    }

    await conexion.beginTransaction();

    const [resultado] = await conexion.query(
      `INSERT INTO gastos (usuario_id, categoria_id, viaje_id, monto, iva, moneda, descripcion, ubicacion, fecha, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [req.user.id, categoria_id, viaje_id, monto, iva || 0, moneda || 'MXN', descripcion || null, ubicacion || null, fecha, estado]
    );

    if (estado === ESTADO_GASTO.PENDIENTE) {
      await crearNotificacionAdmins(conexion, {
        tipo: TIPO_NOTIFICACION.PENDIENTE,
        titulo: `Nuevo gasto de ${req.user.nombre}`,
        detalle: `$${Number(monto).toFixed(2)}${descripcion ? ' · ' + descripcion : ''}`,
      });
    }

    await conexion.commit();

    res.status(201).json({ id: resultado[0].id, estado });
  } catch (err) {
    await conexion.rollback();
    next(err);
  } finally {
    conexion.release();
  }
}

async function listar(req, res, next) {
  try {
    const { estado, categoria_id, fecha_desde, fecha_hasta, usuario_id, viaje_id } = req.query;
    const condiciones = [];
    const params = [];

    if (req.user.rol !== ROL.ADMIN) {
      condiciones.push('g.usuario_id = ?');
      params.push(req.user.id);
    } else if (usuario_id) {
      condiciones.push('g.usuario_id = ?');
      params.push(usuario_id);
    }

    if (estado) {
      condiciones.push('g.estado = ?');
      params.push(estado);
    }
    if (categoria_id) {
      condiciones.push('g.categoria_id = ?');
      params.push(categoria_id);
    }
    if (viaje_id) {
      condiciones.push('g.viaje_id = ?');
      params.push(viaje_id);
    }
    if (fecha_desde) {
      condiciones.push('g.fecha >= ?');
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      condiciones.push('g.fecha <= ?');
      params.push(fecha_hasta);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [filas] = await pool.query(
      `SELECT g.id, g.monto, g.iva, g.moneda, g.descripcion, g.ubicacion, g.foto_url, g.factura_url, g.factura_xml_url, g.estado,
              g.fecha, g.fecha_creacion, g.viaje_id, g.categoria_id,
              c.nombre AS categoria, u.nombre AS empleado, u.id AS usuario_id
       FROM gastos g
       JOIN categorias c ON c.id = g.categoria_id
       JOIN usuarios u ON u.id = g.usuario_id
       ${where}
       ORDER BY g.fecha_creacion DESC`,
      params
    );

    res.json(filas);
  } catch (err) {
    next(err);
  }
}

async function obtenerGastoOAutorizar(id, user) {
  const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ?', [id]);
  const gasto = filas[0];
  if (!gasto) {
    throw new AppError('Gasto no encontrado', 404);
  }
  if (user.rol !== ROL.ADMIN && gasto.usuario_id !== user.id) {
    throw new AppError('No tienes permiso sobre este gasto', 403);
  }
  return gasto;
}

// Detalle "especifico" de un gasto: se pide solo cuando el usuario abre el
// detalle (no en el listado general), y trae datos que listar() no incluye
// -como el motivo de rechazo, que vive en otra tabla- para no cargar ese
// JOIN de mas en cada fila de una tabla con muchos gastos.
async function obtenerUno(req, res, next) {
  try {
    await obtenerGastoOAutorizar(req.params.id, req.user);

    const [filas] = await pool.query(
      `SELECT g.*, c.nombre AS categoria, u.nombre AS empleado,
              a.comentario
       FROM gastos g
       JOIN categorias c ON c.id = g.categoria_id
       JOIN usuarios u ON u.id = g.usuario_id
       LEFT JOIN LATERAL (
         SELECT comentario FROM aprobaciones
         WHERE gasto_id = g.id AND estado = 'rechazado'
         ORDER BY fecha_aprobacion DESC LIMIT 1
       ) a ON true
       WHERE g.id = ?`,
      [req.params.id]
    );

    res.json(filas[0]);
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  const conexion = await pool.getConnection();
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede editarlo', 403);
    }
    if (!ESTADOS_EDITABLES.includes(gasto.estado)) {
      throw new AppError('Solo se pueden editar gastos en borrador o pendientes', 400);
    }

    const { monto, categoria_id, descripcion, fecha, enviar, moneda, ubicacion, iva } = req.body;
    const estado = enviar ? ESTADO_GASTO.PENDIENTE : gasto.estado;

    await conexion.beginTransaction();

    await conexion.query(
      `UPDATE gastos SET
        monto = COALESCE(?, monto),
        iva = COALESCE(?, iva),
        categoria_id = COALESCE(?, categoria_id),
        descripcion = COALESCE(?, descripcion),
        fecha = COALESCE(?, fecha),
        moneda = COALESCE(?, moneda),
        ubicacion = COALESCE(?, ubicacion),
        estado = ?
       WHERE id = ?`,
      [monto ?? null, iva ?? null, categoria_id ?? null, descripcion ?? null, fecha ?? null, moneda ?? null, ubicacion ?? null, estado, gasto.id]
    );

    if (gasto.estado === ESTADO_GASTO.BORRADOR && estado === ESTADO_GASTO.PENDIENTE) {
      await crearNotificacionAdmins(conexion, {
        tipo: TIPO_NOTIFICACION.PENDIENTE,
        titulo: `Nuevo gasto de ${req.user.nombre}`,
        detalle: `$${Number(monto ?? gasto.monto).toFixed(2)}${(descripcion ?? gasto.descripcion) ? ' · ' + (descripcion ?? gasto.descripcion) : ''}`,
      });
    }

    await conexion.commit();

    res.json({ mensaje: 'Gasto actualizado' });
  } catch (err) {
    await conexion.rollback();
    next(err);
  } finally {
    conexion.release();
  }
}

async function eliminar(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede eliminarlo', 403);
    }
    if (!ESTADOS_EDITABLES.includes(gasto.estado)) {
      throw new AppError('Solo se pueden eliminar gastos en borrador o pendientes', 400);
    }

    await pool.query('DELETE FROM gastos WHERE id = ?', [gasto.id]);
    res.json({ mensaje: 'Gasto eliminado' });
  } catch (err) {
    next(err);
  }
}

async function subirComprobante(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede subir el comprobante', 403);
    }
    if (!req.file) {
      throw new AppError('No se recibio ningun archivo', 400);
    }

    await pool.query('UPDATE gastos SET foto_url = ? WHERE id = ?', [req.file.filename, gasto.id]);

    res.json({ comprobante_url: `/api/gastos/${gasto.id}/comprobante` });
  } catch (err) {
    next(err);
  }
}

async function verComprobante(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (!gasto.foto_url) {
      throw new AppError('Este gasto no tiene comprobante', 404);
    }

    // basename descarta cualquier componente de ruta: protege contra
    // path traversal y tolera las filas viejas guardadas como "/uploads/x.jpg".
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    res.sendFile(path.join(uploadDir, path.basename(gasto.foto_url)));
  } catch (err) {
    next(err);
  }
}

// Factura fiscal, separada del recibo/comprobante (foto_url): muchas
// empresas piden ambos documentos y no siempre coinciden en formato.
async function subirFactura(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede subir la factura', 403);
    }
    if (!req.file) {
      throw new AppError('No se recibio ningun archivo', 400);
    }

    await pool.query('UPDATE gastos SET factura_url = ? WHERE id = ?', [req.file.filename, gasto.id]);

    res.json({ factura_url: `/api/gastos/${gasto.id}/factura` });
  } catch (err) {
    next(err);
  }
}

async function verFactura(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (!gasto.factura_url) {
      throw new AppError('Este gasto no tiene factura', 404);
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    res.sendFile(path.join(uploadDir, path.basename(gasto.factura_url)));
  } catch (err) {
    next(err);
  }
}

// XML del CFDI, separado del PDF (factura_url): el formulario los sube como
// dos campos independientes, igual que el backend los guarda en columnas
// independientes.
async function subirFacturaXml(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (gasto.usuario_id !== req.user.id) {
      throw new AppError('Solo el dueno del gasto puede subir la factura', 403);
    }
    if (!req.file) {
      throw new AppError('No se recibio ningun archivo', 400);
    }

    await pool.query('UPDATE gastos SET factura_xml_url = ? WHERE id = ?', [req.file.filename, gasto.id]);

    res.json({ factura_xml_url: `/api/gastos/${gasto.id}/factura-xml` });
  } catch (err) {
    next(err);
  }
}

async function verFacturaXml(req, res, next) {
  try {
    const gasto = await obtenerGastoOAutorizar(req.params.id, req.user);
    if (!gasto.factura_xml_url) {
      throw new AppError('Este gasto no tiene factura XML', 404);
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    res.sendFile(path.join(uploadDir, path.basename(gasto.factura_xml_url)));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  extraerRecibo,
  crear,
  listar,
  obtenerUno,
  actualizar,
  eliminar,
  subirComprobante,
  verComprobante,
  subirFactura,
  verFactura,
  subirFacturaXml,
  verFacturaXml,
  obtenerGastoOAutorizar,
};
