-- 003 - Tabla de notificaciones
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/003_notificaciones.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.
--
-- Las filas se generan solo desde el backend (gasto aprobado/rechazado,
-- gasto nuevo pendiente, viaje nuevo asignado), nunca desde un endpoint
-- publico de escritura: el usuario solo puede leer y marcar como leidas
-- sus propias filas (ver src/controllers/notificaciones.controller.js).

BEGIN;

CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('aprobado', 'rechazado', 'pendiente', 'viaje', 'info')),
  titulo VARCHAR(255) NOT NULL,
  detalle VARCHAR(500),
  leido BOOLEAN NOT NULL DEFAULT false,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
