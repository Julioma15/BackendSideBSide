-- 002 - Modulo de viajes + campos que el frontend necesita y no existian
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/002_viajes_y_campos_gasto.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.
--
-- `gastos.viaje_id` se agrega nullable a proposito: si ya hay gastos en la
-- base, un NOT NULL directo rompe la migracion porque no hay con que
-- rellenarlos. La obligatoriedad para gastos NUEVOS vive en validarGasto
-- (src/utils/validations.js), igual que otras reglas de negocio que no
-- estan en un CHECK de la tabla.
--
-- `moneda`, `categorias.color` y `categorias.icono` si van NOT NULL con
-- DEFAULT: son seguros de agregar aunque ya existan filas, porque Postgres
-- rellena las existentes con el default al momento del ALTER.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS num_empleado VARCHAR(30);

ALTER TABLE categorias ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#6b7280';
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS icono VARCHAR(50) NOT NULL DEFAULT 'Package';

CREATE TABLE IF NOT EXISTS viajes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  presupuesto DECIMAL(10, 2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'completado')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS viaje_id INT REFERENCES viajes(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL DEFAULT 'MXN';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255);

COMMIT;
