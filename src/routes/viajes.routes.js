const express = require('express');
const router = express.Router();
const viajesController = require('../controllers/viajes.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');

router.use(verificarToken);

router.post('/', soloAdmin, viajesController.crear);
router.get('/', viajesController.listar);
router.get('/:id', viajesController.obtenerUno);
router.put('/:id', soloAdmin, viajesController.actualizar);

module.exports = router;
