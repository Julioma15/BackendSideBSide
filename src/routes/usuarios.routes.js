const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');

router.use(verificarToken, soloAdmin);

router.get('/', usuariosController.listar);
router.post('/', usuariosController.crear);
router.delete('/:id', usuariosController.eliminar);

module.exports = router;
