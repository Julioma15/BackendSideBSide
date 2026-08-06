const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');

router.get('/', verificarToken, categoriasController.listar);
router.post('/', verificarToken, soloAdmin, categoriasController.crear);
router.put('/:id', verificarToken, soloAdmin, categoriasController.actualizar);

module.exports = router;
