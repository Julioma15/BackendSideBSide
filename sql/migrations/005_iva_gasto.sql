-- 005 - Desglose de IVA en el gasto
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/005_iva_gasto.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.

BEGIN;

-- IVA pagado dentro del monto total del gasto (no es un monto adicional:
-- va incluido en gastos.monto). Default 0 para no romper gastos ya
-- capturados sin este dato.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva DECIMAL(10, 2) NOT NULL DEFAULT 0;

COMMIT;
