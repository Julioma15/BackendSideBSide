const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');

router.use(verificarToken, soloAdmin);

router.get('/totales', reportesController.totales);
router.get('/por-categoria', reportesController.porCategoria);
router.get('/por-empleado', reportesController.porEmpleado);
router.get('/', reportesController.general);

module.exports = router;
