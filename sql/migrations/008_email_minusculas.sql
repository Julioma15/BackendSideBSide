-- 008 - Correos siempre en minusculas
--
-- Aplicar sobre una base que ya tiene datos:
--   psql -U postgres -d sidebside -f sql/migrations/008_email_minusculas.sql
--
-- Las bases nuevas no necesitan esto: schema.sql ya viene actualizado.
--
-- El backend ya normaliza los correos al crear usuarios y al iniciar sesion;
-- esto corrige los que se guardaron antes con mayusculas (el celular pone la
-- primera letra en mayuscula sola) y evita que vuelva a pasar.
-- Si dos cuentas solo difieren en mayusculas, el UPDATE falla por el UNIQUE:
-- hay que decidir a mano cual se queda antes de reintentar.

BEGIN;

UPDATE usuarios SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email));

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_minusculas;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_email_minusculas CHECK (email = LOWER(email));

COMMIT;
