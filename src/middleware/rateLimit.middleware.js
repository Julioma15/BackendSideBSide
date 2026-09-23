const rateLimit = require('express-rate-limit');

// Protege /login contra fuerza bruta y credential stuffing. No cuenta
// intentos exitosos (skipSuccessfulRequests) para no bloquear a alguien que
// ya esta usando la app normalmente si comparte IP con otros (ej. oficina).
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesion. Intenta de nuevo en unos minutos.' },
});

// /olvide-contrasena y /restablecer-contrasena: mas estricto porque cada
// intento manda un correo real (evita spam a la bandeja de alguien) o
// prueba un token de un solo uso (evita fuerza bruta sobre el token).
const limiteRecuperacion = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo mas tarde.' },
});

// /gastos/extraer-recibo: la capa gratis de Gemini tiene cuota limitada por
// minuto para toda la cuenta (compartida entre todos los operadores), asi
// que un limite generoso por persona evita que un clic accidental repetido
// se coma la cuota del resto del equipo.
const limiteExtraccion = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de lectura automatica. Espera unos minutos o completa el formulario a mano.' },
});

module.exports = { limiteLogin, limiteRecuperacion, limiteExtraccion };
