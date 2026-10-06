// Entorno de pruebas. Se carga ANTES que la app (con --require en
// package.json) para que dotenv, que no pisa variables ya definidas, respete
// estos valores en vez de los de .env:
//  - Base de datos separada: las pruebas la borran y recrean en cada archivo,
//    asi que nunca deben apuntar a la base `sidebside` de desarrollo.
//  - SMTP y Gemini vacios: crear viajes/usuarios manda correos reales si hay
//    credenciales, y la extraccion con IA gasta cuota de la capa gratis.
require('dotenv').config();

process.env.DB_NAME = process.env.TEST_DB_NAME || 'sidebside_test';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.GEMINI_API_KEY = '';
process.env.NODE_ENV = 'test';
