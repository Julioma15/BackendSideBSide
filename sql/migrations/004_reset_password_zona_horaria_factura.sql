-- 004 - Recuperacion de contrasena, zona horaria por usuario, factura del gasto
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/004_reset_password_zona_horaria_factura.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.

BEGIN;

-- Recuperacion de contrasena por correo (src/controllers/auth.controller.js
-- olvideContrasena/restablecerContrasena). Se guarda el HASH del token, no
-- el token en claro, igual que la contrasena.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMPTZ;

-- Zona horaria preferida del usuario (RF: configurar zona horaria), usada
-- para mostrar fechas/horas con hora real (ej. fecha_creacion de un gasto)
-- en vez de asumir siempre la del servidor.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS zona_horaria VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City';

-- Factura fiscal del gasto, separada del comprobante/recibo (gastos.foto_url).
-- Muchas empresas piden factura en PDF o imagen ademas del ticket.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS factura_url VARCHAR(255);

COMMIT;
