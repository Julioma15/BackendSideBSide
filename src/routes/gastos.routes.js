const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastos.controller');
const aprobacionesController = require('../controllers/aprobaciones.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');
const { upload } = require('../middleware/upload.middleware');

router.use(verificarToken);

// Aprobaciones (admin) - rutas especificas antes que /:id para evitar colisiones
router.get('/pendientes', soloAdmin, aprobacionesController.listarPendientes);
router.put('/:id/aprobar', soloAdmin, aprobacionesController.aprobar);
router.put('/:id/rechazar', soloAdmin, aprobacionesController.rechazar);
router.post('/:id/comprobante', upload.single('foto'), gastosController.subirComprobante);

// CRUD de gastos
router.post('/', gastosController.crear);
router.get('/', gastosController.listar);
router.get('/:id', gastosController.obtenerUno);
router.put('/:id', gastosController.actualizar);
router.delete('/:id', gastosController.eliminar);

module.exports = router;
