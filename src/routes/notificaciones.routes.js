const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificaciones.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.use(verificarToken);

router.get('/', notificacionesController.listar);
router.put('/leer-todas', notificacionesController.marcarTodasLeidas);
router.put('/:id/leer', notificacionesController.marcarLeida);

module.exports = router;
