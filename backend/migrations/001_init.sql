-- =============================================================================
-- SIA — Sistema Integral Académico
-- Migración inicial del esquema de Base de Datos.
-- Ejecuta con `npm run migrate` desde la carpeta backend/.
--
-- Esquema relacional completo para los módulos del sistema:
--   usuarios, académico (carreras_grados, materias, grupos, matriculas),
--   notas, asistencia, tareas, eventos, mensajes e instituciones.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS academico
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE academico;

-- Reemplazo total del esquema: elimina versiones previas de las tablas.
-- El orden importa (hijas primero) para respetar las claves foráneas.
DROP TABLE IF EXISTS acudiente_estudiante;
DROP TABLE IF EXISTS notificaciones;
DROP TABLE IF EXISTS mensajes;
DROP TABLE IF EXISTS eventos_calendario;
DROP TABLE IF EXISTS entregas_tareas;
DROP TABLE IF EXISTS tareas;
DROP TABLE IF EXISTS asistencia_audit;
DROP TABLE IF EXISTS asistencia;
DROP TABLE IF EXISTS notas;
DROP TABLE IF EXISTS matriculas;
DROP TABLE IF EXISTS grupos;
DROP TABLE IF EXISTS materias;
DROP TABLE IF EXISTS carreras_grados;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS instituciones;

-- ---------------------------------------------------------------------------
-- instituciones: datos de la institución educativa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instituciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  correo VARCHAR(150) DEFAULT NULL,
  telefono VARCHAR(30) DEFAULT NULL,
  departamento VARCHAR(80) DEFAULT NULL,
  ciudad VARCHAR(80) DEFAULT NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- usuarios: cuentas del sistema (admin, profesor, estudiante, acudiente).
-- La columna `password` almacena el hash generado con bcrypt (nunca en texto plano).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo VARCHAR(150) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  rol ENUM('admin','profesor','estudiante','acudiente') NOT NULL,
  foto_url VARCHAR(255) DEFAULT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- carreras_grados: carreras o grados ofrecidos por la institución.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carreras_grados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- materias: asignaturas pertenecientes a una carrera o grado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  carrera_id INT DEFAULT NULL,
  CONSTRAINT fk_materias_carrera
    FOREIGN KEY (carrera_id) REFERENCES carreras_grados(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- grupos: agrupación de una materia dictada por un profesor en un periodo.
-- codigo_grupo: código o ficha que identifica al grupo dentro de la materia
-- (permite varios grupos/fichas para una misma asignatura, ej. 1003, 801).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  materia_id INT NOT NULL,
  codigo_grupo VARCHAR(30) NOT NULL,
  profesor_id INT NOT NULL,
  periodo VARCHAR(20) NOT NULL,
  horario VARCHAR(120) DEFAULT NULL,
  CONSTRAINT fk_grupos_materia
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  CONSTRAINT fk_grupos_profesor
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- matriculas: vinculan a un estudiante (usuario) con un grupo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matriculas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  fecha_matricula DATE NOT NULL,
  UNIQUE KEY uq_matricula (estudiante_id, grupo_id),
  CONSTRAINT fk_matriculas_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_matriculas_grupo
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- notas: calificaciones por matrícula.
--   Ponderación: nota_1 (25%), nota_2 (25%), nota_3 (20%), examen_final (30%).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL UNIQUE,
  nota_1 DECIMAL(5,2) DEFAULT NULL,
  nota_2 DECIMAL(5,2) DEFAULT NULL,
  nota_3 DECIMAL(5,2) DEFAULT NULL,
  examen_final DECIMAL(5,2) DEFAULT NULL,
  nota_definitiva DECIMAL(5,2) DEFAULT NULL,
  observaciones VARCHAR(255) DEFAULT NULL,
  CONSTRAINT fk_notas_matricula
    FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- asistencia: control de presencia por matrícula y fecha.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistencia (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('presente','ausente','tarde','excusa') NOT NULL DEFAULT 'presente',
  observacion VARCHAR(255) DEFAULT NULL,
  archivo_ruta VARCHAR(255) DEFAULT NULL,
  archivo_mime VARCHAR(100) DEFAULT NULL,
  archivo_nombre VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uq_asistencia (matricula_id, fecha),
  CONSTRAINT fk_asistencia_matricula
    FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- tareas: actividades asignadas a un grupo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  fecha_entrega DATETIME DEFAULT NULL,
  puntaje_max DECIMAL(5,2) NOT NULL DEFAULT 10,
  CONSTRAINT fk_tareas_grupo
    FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- entregas_tareas: envíos de estudiantes para cada tarea.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entregas_tareas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tarea_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  archivo_url VARCHAR(255) DEFAULT NULL,
  fecha_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  calificacion DECIMAL(5,2) DEFAULT NULL,
  comentario VARCHAR(255) DEFAULT NULL,
  retroalimentacion VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uq_entrega (tarea_id, estudiante_id),
  CONSTRAINT fk_entregas_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE,
  CONSTRAINT fk_entregas_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- eventos_calendario: actividades del calendario académico.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos_calendario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME DEFAULT NULL,
  tipo ENUM('institucional','evaluacion','entrega','reunion') NOT NULL DEFAULT 'institucional',
  curso_id INT DEFAULT NULL,
  CONSTRAINT fk_eventos_carrera
    FOREIGN KEY (curso_id) REFERENCES carreras_grados(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- mensajes: mensajería interna entre usuarios.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensajes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  remitente_id INT NOT NULL,
  destinatario_id INT NOT NULL,
  contenido TEXT NOT NULL,
  leido TINYINT(1) NOT NULL DEFAULT 0,
  fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mensajes_remitente
    FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_mensajes_destinatario
    FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- notificaciones: alertas para cada usuario (nueva calificación, tarea próxima...).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT DEFAULT NULL,
  tipo ENUM('sistema','nota','tarea','mensaje','evento') NOT NULL DEFAULT 'sistema',
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificaciones_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- acudiente_estudiante: relación muchos-a-muchos entre acudientes y estudiantes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acudiente_estudiante (
  id INT AUTO_INCREMENT PRIMARY KEY,
  acudiente_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  UNIQUE KEY uq_acudiente_estudiante (acudiente_id, estudiante_id),
  CONSTRAINT fk_acudiente
    FOREIGN KEY (acudiente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;