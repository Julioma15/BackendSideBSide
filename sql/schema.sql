-- SideBSide - esquema de base de datos (PostgreSQL)
--
-- Postgres no soporta `CREATE DATABASE IF NOT EXISTS` ni `USE` dentro de un
-- script, y `CREATE DATABASE` no puede correr dentro de una transaccion.
-- Por eso el setup son dos pasos separados:
--
-- 1) Crear la base (una sola vez, conectado a la base `postgres` por defecto):
--      psql -U postgres -c "CREATE DATABASE sidebside;"
--
-- 2) Conectarse a esa base y correr el resto de este archivo:
--      psql -U postgres -d sidebside -f sql/schema.sql
--    (o pegar el contenido de aqui para abajo en pgAdmin / la consola de Workbench de Postgres)

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  contrasena VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'operador' CHECK (rol IN ('operador', 'admin')),
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  empresa VARCHAR(100),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Nota: respecto a la guia original, `gastos.categoria` (VARCHAR libre) se
-- reemplaza por `categoria_id` (FK a categorias) para mantener integridad
-- referencial con el modulo de categorias.
--
-- `fecha` es DATE a proposito: es la fecha del gasto segun el negocio
-- ("el 17 de julio cargue diesel"), no un instante. Ponerle huso horario
-- haria que un gasto del dia 17 se leyera como del 16 en otra zona.

CREATE TABLE gastos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  categoria_id INT NOT NULL REFERENCES categorias(id),
  monto DECIMAL(10, 2) NOT NULL,
  descripcion TEXT,
  foto_url VARCHAR(255),
  estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'pendiente', 'aprobado', 'rechazado')),
  fecha DATE NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE aprobaciones (
  id SERIAL PRIMARY KEY,
  gasto_id INT NOT NULL REFERENCES gastos(id),
  admin_id INT NOT NULL REFERENCES usuarios(id),
  comentario TEXT,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('aprobado', 'rechazado')),
  fecha_aprobacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Rechazar exige motivo; aprobar no. La regla tambien vive en
  -- validations.js, pero aqui queda blindada contra cualquier ruta futura.
  CONSTRAINT rechazo_requiere_comentario
    CHECK (estado <> 'rechazado' OR btrim(coalesce(comentario, '')) <> '')
);

-- Categorias por defecto
INSERT INTO categorias (nombre) VALUES
  ('Combustible'),
  ('Comida'),
  ('Peaje'),
  ('Mantenimiento'),
  ('Viaticos'),
  ('Materiales'),
  ('Otro');
