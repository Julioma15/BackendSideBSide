// Datos de demostracion para presentar la plataforma: un admin, cuatro
// operadores, viajes (pasados, en curso y proximos), gastos en todos los
// estados con su ticket, aprobaciones y notificaciones.
//
// Uso (en la carpeta del backend):
//   node src/utils/datosDemo.js crear "ContrasenaDemo2026"
//   node src/utils/datosDemo.js borrar
//
// Todo lo demo se reconoce por el dominio de los correos (@demo.side-b-side.com).
// "borrar" quita esos usuarios y todo lo que sea suyo, incluido lo que se haya
// creado con ellos durante la presentacion, y sus archivos en uploads/.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { validarFortalezaContrasena } = require('./validations');

const DOMINIO = 'demo.side-b-side.com';
const PATRON_EMAIL = `%@${DOMINIO}`;
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

const ADMIN = { nombre: 'Laura Méndez', email: `laura.mendez@${DOMINIO}`, num: 'ADM-01' };
const OPERADORES = [
  { clave: 'carlos', nombre: 'Carlos Ramírez', email: `carlos.ramirez@${DOMINIO}`, num: 'OP-101' },
  { clave: 'ana', nombre: 'Ana Torres', email: `ana.torres@${DOMINIO}`, num: 'OP-102' },
  { clave: 'miguel', nombre: 'Miguel Hernández', email: `miguel.hernandez@${DOMINIO}`, num: 'OP-103' },
  { clave: 'sofia', nombre: 'Sofía Castillo', email: `sofia.castillo@${DOMINIO}`, num: 'OP-104' },
];

// Fechas relativas a "hoy" en Merida, para que la demo se vea al dia sin
// importar cuando se corra. dia = desplazamiento en dias desde hoy.
// estado del gasto: A aprobado, P pendiente, B borrador, R rechazado.
const VIAJES = [
  {
    op: 'miguel', nombre: 'Mérida → Cancún · Reparto mensual', inicio: -74, fin: -72, presupuesto: 7000, estado: 'completado',
    gastos: [
      { dia: -74, cat: 'Combustible', comercio: 'Pemex Periférico Oriente', concepto: 'Diésel 91.2 L', monto: 2280.0, iva: true, ubicacion: 'Mérida, Yuc.', estado: 'A' },
      { dia: -74, cat: 'Peaje', comercio: 'Caseta Kantunil', concepto: 'Cuota autopista Mérida–Cancún', monto: 515.0, ubicacion: 'Kantunil, Yuc.', estado: 'A' },
      { dia: -73, cat: 'Viaticos', comercio: 'Hotel One Cancún Centro', concepto: 'Hospedaje 2 noches', monto: 1520.0, iva: true, ubicacion: 'Cancún, Q. Roo', estado: 'A' },
      { dia: -73, cat: 'Comida', comercio: 'Los de Pescado Cancún', concepto: 'Comida en ruta', monto: 410.0, iva: true, ubicacion: 'Cancún, Q. Roo', estado: 'A' },
    ],
  },
  {
    op: 'carlos', nombre: 'Mérida → Tizimín · Entrega a distribuidor', inicio: -46, fin: -45, presupuesto: 3500, estado: 'completado',
    gastos: [
      { dia: -46, cat: 'Combustible', comercio: 'Pemex Tizimín', concepto: 'Diésel 65.6 L', monto: 1640.0, iva: true, ubicacion: 'Tizimín, Yuc.', estado: 'A' },
      { dia: -45, cat: 'Comida', comercio: 'Restaurante Tres Reyes', concepto: 'Comida en ruta', monto: 295.0, iva: true, ubicacion: 'Tizimín, Yuc.', estado: 'A' },
    ],
  },
  {
    op: 'sofia', nombre: 'Mérida → Campeche · Auditoría de unidades', inicio: -40, fin: -39, presupuesto: 4500, estado: 'completado',
    gastos: [
      { dia: -40, cat: 'Combustible', comercio: 'Pemex Campeche Malecón', concepto: 'Diésel 71.2 L', monto: 1780.0, iva: true, ubicacion: 'Campeche, Camp.', estado: 'A' },
      { dia: -40, cat: 'Peaje', comercio: 'Caseta Hecelchakán', concepto: 'Cuota autopista Mérida–Campeche', monto: 262.0, ubicacion: 'Hecelchakán, Camp.', estado: 'A' },
      { dia: -39, cat: 'Comida', comercio: 'La Pigua Campeche', concepto: 'Comida con supervisor', monto: 335.0, iva: true, ubicacion: 'Campeche, Camp.', estado: 'A' },
    ],
  },
  {
    op: 'carlos', nombre: 'Mérida → Cancún · Entrega de mercancía', inicio: -12, fin: -9, presupuesto: 8000, estado: 'completado',
    gastos: [
      { dia: -12, cat: 'Combustible', comercio: 'Pemex Periférico Norte', concepto: 'Diésel 92.4 L', monto: 2310.0, iva: true, ubicacion: 'Mérida, Yuc.', estado: 'A' },
      { dia: -12, cat: 'Peaje', comercio: 'Caseta Kantunil', concepto: 'Cuota autopista Mérida–Cancún', monto: 515.0, ubicacion: 'Kantunil, Yuc.', estado: 'A' },
      { dia: -11, cat: 'Comida', comercio: 'Restaurante La Habichuela', concepto: 'Comida en ruta', monto: 386.0, iva: true, ubicacion: 'Cancún, Q. Roo', estado: 'A' },
      { dia: -11, cat: 'Viaticos', comercio: 'Hotel Fiesta Inn Cancún', concepto: 'Hospedaje 1 noche', monto: 1480.0, iva: true, ubicacion: 'Cancún, Q. Roo', estado: 'A' },
      { dia: -9, cat: 'Combustible', comercio: 'Oxxo Gas Cancún Centro', concepto: 'Diésel 85.0 L', monto: 2125.0, iva: true, ubicacion: 'Cancún, Q. Roo', estado: 'A' },
    ],
  },
  {
    op: 'carlos', nombre: 'Mérida → Campeche · Visita a cliente', inicio: -1, fin: 2, presupuesto: 6000, estado: 'activo',
    gastos: [
      { dia: -1, cat: 'Combustible', comercio: 'Pemex Umán', concepto: 'Diésel 78.6 L', monto: 1965.0, iva: true, ubicacion: 'Umán, Yuc.', estado: 'A' },
      { dia: -1, cat: 'Peaje', comercio: 'Caseta Hecelchakán', concepto: 'Cuota autopista Mérida–Campeche', monto: 262.0, ubicacion: 'Hecelchakán, Camp.', estado: 'P' },
      { dia: 0, cat: 'Comida', comercio: 'Marganzo Campeche', concepto: 'Comida con cliente', monto: 742.0, iva: true, ubicacion: 'Campeche, Camp.', estado: 'P' },
      { dia: 0, cat: 'Viaticos', comercio: 'Hotel Plaza Campeche', concepto: 'Hospedaje 1 noche', monto: 1290.0, iva: true, ubicacion: 'Campeche, Camp.', estado: 'B' },
    ],
  },
  {
    op: 'ana', nombre: 'Mérida → Chetumal · Ruta de distribución', inicio: -8, fin: -5, presupuesto: 9000, estado: 'completado',
    gastos: [
      { dia: -8, cat: 'Combustible', comercio: 'Pemex Felipe Carrillo Puerto', concepto: 'Diésel 96.0 L', monto: 2400.0, iva: true, ubicacion: 'F. Carrillo Puerto, Q. Roo', estado: 'A' },
      { dia: -7, cat: 'Comida', comercio: 'Los Milagros Chetumal', concepto: 'Desayuno y comida', monto: 455.0, iva: true, ubicacion: 'Chetumal, Q. Roo', estado: 'A' },
      { dia: -7, cat: 'Mantenimiento', comercio: 'Llantera El Güero', concepto: 'Reparación de llanta y balanceo', monto: 680.0, iva: true, ubicacion: 'Chetumal, Q. Roo', estado: 'R',
        motivo: 'Falta la factura con el RFC de la empresa. Súbela y vuelve a enviarlo.' },
      { dia: -6, cat: 'Viaticos', comercio: 'Hotel Holiday Inn Chetumal', concepto: 'Hospedaje 2 noches', monto: 2760.0, iva: true, ubicacion: 'Chetumal, Q. Roo', estado: 'A' },
    ],
  },
  {
    op: 'ana', nombre: 'Mérida → Villahermosa · Recolección', inicio: 4, fin: 7, presupuesto: 12000, estado: 'activo',
    gastos: [
      { dia: 4, cat: 'Viaticos', comercio: 'City Express Villahermosa', concepto: 'Reservación anticipada 3 noches', monto: 3150.0, iva: true, ubicacion: 'Villahermosa, Tab.', estado: 'P' },
    ],
  },
  {
    op: 'miguel', nombre: 'Mérida → Progreso · Entregas locales', inicio: 0, fin: 1, presupuesto: 2500, estado: 'activo',
    gastos: [
      { dia: 0, cat: 'Combustible', comercio: 'Pemex Progreso', concepto: 'Diésel 40.0 L', monto: 1000.0, iva: true, ubicacion: 'Progreso, Yuc.', estado: 'P' },
      { dia: 0, cat: 'Comida', comercio: 'Crabster Progreso', concepto: 'Comida del equipo de reparto', monto: 310.0, iva: true, ubicacion: 'Progreso, Yuc.', estado: 'P' },
    ],
  },
  {
    op: 'sofia', nombre: 'Mérida → Valladolid · Mantenimiento de unidad', inicio: -4, fin: -3, presupuesto: 4000, estado: 'completado',
    gastos: [
      { dia: -4, cat: 'Peaje', comercio: 'Caseta Pisté', concepto: 'Cuota autopista Mérida–Valladolid', monto: 324.0, ubicacion: 'Pisté, Yuc.', estado: 'A' },
      { dia: -4, cat: 'Mantenimiento', comercio: 'Taller Mecánico Hermanos Canul', concepto: 'Cambio de aceite y filtros', monto: 1850.0, iva: true, ubicacion: 'Valladolid, Yuc.', estado: 'A' },
      { dia: -3, cat: 'Comida', comercio: 'Restaurante El Atrio del Mayab', concepto: 'Comida en ruta', monto: 268.0, iva: true, ubicacion: 'Valladolid, Yuc.', estado: 'A' },
      { dia: -3, cat: 'Combustible', comercio: 'Gasolinera Valladolid Centro', concepto: 'Diésel 52.0 L', monto: 1300.0, iva: true, ubicacion: 'Valladolid, Yuc.', estado: 'R',
        motivo: 'El ticket no se lee bien. Toma otra foto con buena luz y vuelve a enviarlo.' },
    ],
  },
];

const ESTADOS = { A: 'aprobado', P: 'pendiente', B: 'borrador', R: 'rechazado' };

function hoyMerida() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Merida' }).format(new Date());
}

function sumarDias(fechaIso, dias) {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Timestamp a una hora razonable de ese dia en Merida (UTC-6).
function momento(fechaIso, hora) {
  return `${fechaIso}T${String(hora).padStart(2, '0')}:${String((hora * 7) % 60).padStart(2, '0')}:00-06:00`;
}

function ivaIncluido(monto) {
  return Math.round((monto - monto / 1.16) * 100) / 100;
}

function escaparXml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Ticket generado como SVG: se ve como un recibo real en el visor de
// comprobantes sin depender de fotos de terceros.
function ticketSvg({ comercio, concepto, ubicacion, fecha, hora, monto, iva, folio }) {
  const pesos = (n) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const [y, m, d] = fecha.split('-');
  const lineas = [
    ['', ''],
    ['Fecha', `${d}/${m}/${y} ${String(hora).padStart(2, '0')}:${String((hora * 7) % 60).padStart(2, '0')}`],
    ['Folio', folio],
    ['', ''],
    [concepto, pesos(monto)],
    ['', ''],
    ['Subtotal', pesos(monto - iva)],
    ['IVA 16%', iva ? pesos(iva) : pesos(0)],
  ];
  let yPos = 150;
  const filas = lineas.map(([izq, der]) => {
    yPos += 26;
    if (!izq && !der) return '';
    return `<text x="28" y="${yPos}">${escaparXml(izq)}</text><text x="352" y="${yPos}" text-anchor="end">${escaparXml(der)}</text>`;
  }).join('');
  const alto = yPos + 150;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="380" height="${alto}" viewBox="0 0 380 ${alto}">
  <rect width="380" height="${alto}" fill="#fdfdf8"/>
  <g font-family="Courier New, monospace" fill="#222" font-size="15">
    <text x="190" y="52" text-anchor="middle" font-size="19" font-weight="bold">${escaparXml(comercio.toUpperCase())}</text>
    <text x="190" y="78" text-anchor="middle">${escaparXml(ubicacion)}</text>
    <text x="190" y="102" text-anchor="middle">RFC: XAXX010101000</text>
    <text x="190" y="138" text-anchor="middle">------------------------------</text>
    ${filas}
    <text x="190" y="${yPos + 30}" text-anchor="middle">------------------------------</text>
    <text x="28" y="${yPos + 62}" font-size="19" font-weight="bold">TOTAL</text>
    <text x="352" y="${yPos + 62}" text-anchor="end" font-size="19" font-weight="bold">${escaparXml(pesos(monto))}</text>
    <text x="190" y="${yPos + 108}" text-anchor="middle" font-size="13">GRACIAS POR SU COMPRA</text>
  </g>
</svg>
`;
}

async function crear(contrasena) {
  validarFortalezaContrasena(contrasena);

  const [existentes] = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios WHERE email LIKE ?', [PATRON_EMAIL]);
  if (existentes[0].n > 0) {
    throw new Error('Ya hay datos demo. Corre primero: node src/utils/datosDemo.js borrar');
  }

  const [cats] = await pool.query('SELECT id, nombre FROM categorias');
  const categoriaId = (nombre) => {
    const c = cats.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!c) throw new Error(`No existe la categoria "${nombre}"`);
    return c.id;
  };

  const hoy = hoyMerida();
  const hash = await bcrypt.hash(contrasena, 10);
  const archivos = [];
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    const [adminRows] = await conexion.query(
      'INSERT INTO usuarios (nombre, email, contrasena, rol, num_empleado) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [ADMIN.nombre, ADMIN.email, hash, 'admin', ADMIN.num]
    );
    const adminId = adminRows[0].id;

    const ids = {};
    for (const op of OPERADORES) {
      const [filas] = await conexion.query(
        'INSERT INTO usuarios (nombre, email, contrasena, rol, num_empleado) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [op.nombre, op.email, hash, 'operador', op.num]
      );
      ids[op.clave] = { id: filas[0].id, nombre: op.nombre };
    }

    let folio = 48210;
    let gastosCreados = 0;
    for (const v of VIAJES) {
      const op = ids[v.op];
      const inicio = sumarDias(hoy, v.inicio);
      const fin = sumarDias(hoy, v.fin);
      const creadoViaje = momento(sumarDias(inicio, -3), 10);

      const [viajeRows] = await conexion.query(
        `INSERT INTO viajes (nombre, usuario_id, fecha_inicio, fecha_fin, presupuesto, estado, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [v.nombre, op.id, inicio, fin, v.presupuesto, v.estado, creadoViaje]
      );
      const viajeId = viajeRows[0].id;

      await conexion.query(
        'INSERT INTO notificaciones (usuario_id, tipo, titulo, detalle, leido, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?)',
        [op.id, 'viaje', `Nuevo viaje asignado: ${v.nombre}`, `${inicio} → ${fin}`, v.inicio < 0, creadoViaje]
      );

      for (const [i, g] of v.gastos.entries()) {
        const fecha = sumarDias(hoy, g.dia);
        const hora = 9 + ((i * 3) % 10);
        const estado = ESTADOS[g.estado];
        const iva = g.iva ? ivaIncluido(g.monto) : 0;
        // Un gasto "de hoy" o futuro (pago adelantado) se registro hoy.
        const creado = g.dia >= 0 ? momento(hoy, Math.min(hora, 12)) : momento(fecha, hora);
        folio += 137;

        const [gastoRows] = await conexion.query(
          `INSERT INTO gastos (usuario_id, categoria_id, viaje_id, monto, iva, moneda, descripcion, ubicacion, fecha, estado, fecha_creacion)
           VALUES (?, ?, ?, ?, ?, 'MXN', ?, ?, ?, ?, ?) RETURNING id`,
          [op.id, categoriaId(g.cat), viajeId, g.monto, iva, `${g.comercio} · ${g.concepto}`, g.ubicacion, fecha, estado, creado]
        );
        const gastoId = gastoRows[0].id;

        const archivo = `demo-${gastoId}.svg`;
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, archivo), ticketSvg({ ...g, fecha, hora, iva, folio: `A-${folio}` }));
        archivos.push(archivo);
        await conexion.query('UPDATE gastos SET foto_url = ? WHERE id = ?', [archivo, gastoId]);
        gastosCreados++;

        const pesos = `$${g.monto.toFixed(2)}`;
        if (estado !== 'borrador') {
          await conexion.query(
            'INSERT INTO notificaciones (usuario_id, tipo, titulo, detalle, leido, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?)',
            [adminId, 'pendiente', `Nuevo gasto de ${op.nombre}`, `${pesos} · ${g.comercio}`, estado !== 'pendiente', creado]
          );
        }
        if (estado === 'aprobado' || estado === 'rechazado') {
          const revisado = momento(g.dia >= 0 ? hoy : sumarDias(fecha, 1), 17);
          await conexion.query(
            'INSERT INTO aprobaciones (gasto_id, admin_id, comentario, estado, fecha_aprobacion) VALUES (?, ?, ?, ?, ?)',
            [gastoId, adminId, g.motivo || null, estado, revisado]
          );
          await conexion.query(
            'INSERT INTO notificaciones (usuario_id, tipo, titulo, detalle, leido, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?)',
            [
              op.id,
              estado,
              `Gasto ${estado} — ${pesos}`,
              estado === 'rechazado' ? `Motivo: ${g.motivo}` : `${g.comercio} · ${g.concepto}`,
              estado === 'aprobado' && g.dia < -2,
              revisado,
            ]
          );
        }
      }
    }

    await conexion.commit();

    console.log(`Datos demo creados: 1 admin, ${OPERADORES.length} operadores, ${VIAJES.length} viajes, ${gastosCreados} gastos.`);
    console.log('Entra con cualquiera de estos correos y la contrasena que pusiste:');
    console.log(`  admin     ${ADMIN.email}`);
    for (const op of OPERADORES) console.log(`  operador  ${op.email}`);
  } catch (err) {
    await conexion.rollback().catch(() => {});
    for (const a of archivos) fs.rmSync(path.join(uploadDir, a), { force: true });
    throw err;
  } finally {
    conexion.release();
  }
}

async function borrar() {
  const conexion = await pool.getConnection();
  let archivos = [];
  try {
    await conexion.beginTransaction();

    const [usuarios] = await conexion.query('SELECT id FROM usuarios WHERE email LIKE ?', [PATRON_EMAIL]);
    const ids = usuarios.map((u) => u.id);
    if (ids.length === 0) {
      await conexion.rollback();
      console.log('No hay datos demo que borrar.');
      return;
    }

    const [gastos] = await conexion.query(
      `SELECT id, foto_url, factura_url, factura_xml_url FROM gastos
       WHERE usuario_id = ANY(?) OR viaje_id IN (SELECT id FROM viajes WHERE usuario_id = ANY(?))`,
      [ids, ids]
    );
    const gastoIds = gastos.map((g) => g.id);
    archivos = gastos.flatMap((g) => [g.foto_url, g.factura_url, g.factura_xml_url]).filter(Boolean);

    // Aprobaciones de gastos demo, y las que haya hecho el admin demo.
    await conexion.query('DELETE FROM aprobaciones WHERE gasto_id = ANY(?) OR admin_id = ANY(?)', [gastoIds, ids]);
    await conexion.query('DELETE FROM gastos WHERE id = ANY(?)', [gastoIds]);
    await conexion.query('DELETE FROM viajes WHERE usuario_id = ANY(?)', [ids]);
    await conexion.query('DELETE FROM notificaciones WHERE usuario_id = ANY(?)', [ids]);
    await conexion.query('DELETE FROM usuarios WHERE id = ANY(?)', [ids]);

    await conexion.commit();
    console.log(`Datos demo borrados: ${ids.length} usuarios, ${gastoIds.length} gastos.`);
  } catch (err) {
    await conexion.rollback().catch(() => {});
    throw err;
  } finally {
    conexion.release();
  }

  for (const a of archivos) fs.rmSync(path.join(uploadDir, path.basename(a)), { force: true });
}

async function main() {
  const [accion, contrasena] = process.argv.slice(2);
  if (accion === 'crear' && contrasena) {
    await crear(contrasena);
  } else if (accion === 'borrar') {
    await borrar();
  } else {
    console.error('Uso:\n  node src/utils/datosDemo.js crear "ContrasenaDemo2026"\n  node src/utils/datosDemo.js borrar');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
