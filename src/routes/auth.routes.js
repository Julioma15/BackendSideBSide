const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth.middleware');
const { soloAdmin } = require('../middleware/role.middleware');
const { limiteLogin, limiteRecuperacion } = require('../middleware/rateLimit.middleware');

// Solo un admin autenticado puede crear nuevos usuarios (RF1.5).
// El primer admin se crea con src/utils/crearAdmin.js (ver README).
router.post('/register', verificarToken, soloAdmin, authController.register);
router.post('/login', limiteLogin, authController.login);
router.post('/logout', verificarToken, authController.logout);
router.put('/cambiar-contrasena', verificarToken, authController.cambiarContrasena);
router.post('/olvide-contrasena', limiteRecuperacion, authController.olvideContrasena);
router.post('/restablecer-contrasena', limiteRecuperacion, authController.restablecerContrasena);
router.put('/zona-horaria', verificarToken, authController.actualizarZonaHoraria);

module.exports = router;
