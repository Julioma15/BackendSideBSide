-- 001 - Timestamps con huso horario + comentario obligatorio al rechazar
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/001_timestamptz_y_check_rechazo.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.
--
-- Sobre `AT TIME ZONE 'UTC'`: los valores existentes los genero
-- CURRENT_TIMESTAMP del propio Postgres, cuyo TimeZone es GMT, asi que ya
-- son UTC. Se declara explicito para que la conversion no dependa del huso
-- de la sesion que corra este script.

BEGIN;

ALTER TABLE usuarios
  ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ
  USING fecha_creacion AT TIME ZONE 'UTC';

ALTER TABLE categorias
  ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ
  USING fecha_creacion AT TIME ZONE 'UTC';

ALTER TABLE gastos
  ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ
  USING fecha_creacion AT TIME ZONE 'UTC';

ALTER TABLE aprobaciones
  ALTER COLUMN fecha_aprobacion TYPE TIMESTAMPTZ
  USING fecha_aprobacion AT TIME ZONE 'UTC';

-- gastos.fecha se queda como DATE a proposito (ver nota en schema.sql).

ALTER TABLE aprobaciones
  ADD CONSTRAINT rechazo_requiere_comentario
  CHECK (estado <> 'rechazado' OR btrim(coalesce(comentario, '')) <> '');

COMMIT;
