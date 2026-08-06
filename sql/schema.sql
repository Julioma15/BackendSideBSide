-- SideBSide - esquema de base de datos
-- Ejecutar en MySQL Workbench (o `mysql -u root -p < schema.sql`)

CREATE DATABASE IF NOT EXISTS sidebside
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE sidebside;

-- Nota: respecto a la guia original, `gastos.categoria` (VARCHAR libre) se
-- reemplaza por `categoria_id` (FK a categorias) para mantener integridad
-- referencial con el modulo de categorias.

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  contrasena VARCHAR(255) NOT NULL,
  rol ENUM('operador', 'admin') DEFAULT 'operador',
  estado ENUM('activo', 'inactivo') DEFAULT 'activo',
  empresa VARCHAR(100),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  estado ENUM('activo', 'inactivo') DEFAULT 'activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gastos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  categoria_id INT NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  descripcion TEXT,
  foto_url VARCHAR(255),
  estado ENUM('borrador', 'pendiente', 'aprobado', 'rechazado') DEFAULT 'borrador',
  fecha DATE NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE aprobaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gasto_id INT NOT NULL,
  admin_id INT NOT NULL,
  comentario TEXT,
  estado ENUM('aprobado', 'rechazado') NOT NULL,
  fecha_aprobacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gasto_id) REFERENCES gastos(id),
  FOREIGN KEY (admin_id) REFERENCES usuarios(id)
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
