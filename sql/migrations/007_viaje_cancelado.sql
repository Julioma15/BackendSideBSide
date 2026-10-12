-- 007 - Estado "cancelado" para viajes
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/007_viaje_cancelado.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.

BEGIN;

-- Un viaje sin gastos se borra; uno con gastos se cancela, para no perder el
-- registro del dinero que ya se gasto.
ALTER TABLE viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;
ALTER TABLE viajes ADD CONSTRAINT viajes_estado_check
  CHECK (estado IN ('activo', 'completado', 'cancelado'));

COMMIT;
