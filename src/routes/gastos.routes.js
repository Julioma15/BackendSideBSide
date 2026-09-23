const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastos.controller');
const aprobacionesController = require('../controllers/aprobaciones.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');
const { upload, uploadMemoria } = require('../middleware/upload.middleware');
const { limiteExtraccion } = require('../middleware/rateLimit.middleware');

router.use(verificarToken);

// Rutas especificas antes que /:id para evitar colisiones
router.post('/extraer-recibo', limiteExtraccion, uploadMemoria.single('foto'), gastosController.extraerRecibo);

// Aprobaciones (admin)
router.get('/pendientes', soloAdmin, aprobacionesController.listarPendientes);
router.put('/:id/aprobar', soloAdmin, aprobacionesController.aprobar);
router.put('/:id/rechazar', soloAdmin, aprobacionesController.rechazar);
router.post('/:id/comprobante', upload.single('foto'), gastosController.subirComprobante);
router.get('/:id/comprobante', gastosController.verComprobante);
router.post('/:id/factura', upload.single('foto'), gastosController.subirFactura);
router.get('/:id/factura', gastosController.verFactura);
router.post('/:id/factura-xml', upload.single('foto'), gastosController.subirFacturaXml);
router.get('/:id/factura-xml', gastosController.verFacturaXml);

// CRUD de gastos
router.post('/', gastosController.crear);
router.get('/', gastosController.listar);
router.get('/:id', gastosController.obtenerUno);
router.put('/:id', gastosController.actualizar);
router.delete('/:id', gastosController.eliminar);

module.exports = router;
