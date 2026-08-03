-- Ejecuta este script en tu MySQL para crear la base y las tablas.
-- Alternativamente: `npm run migrate` desde la carpeta backend/.

CREATE DATABASE IF NOT EXISTS academico
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE academico;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','profesor','estudiante') NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carreras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  carrera_id INT NULL,
  profesor_id INT NULL,
  FOREIGN KEY (carrera_id) REFERENCES carreras(id) ON DELETE SET NULL,
  FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matriculas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  materia_id INT NOT NULL,
  periodo VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_matricula (estudiante_id, materia_id, periodo),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL UNIQUE,
  parcial DECIMAL(5,2) DEFAULT NULL,
  medio DECIMAL(5,2) DEFAULT NULL,
  final DECIMAL(5,2) DEFAULT NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asistencia (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL,
  fecha DATE NOT NULL,
  presente TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_asistencia (matricula_id, fecha),
  FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE
) ENGINE=InnoDB;
