-- =============================================================================
-- SIA — Sistema Integral Académico
-- Migración inicial del esquema de Base de Datos.
-- Ejecuta con `npm run migrate` desde la carpeta backend/.
--
-- Esquema relacional completo para los módulos del sistema:
--   usuarios, académico de colegio (grados, asignaturas, cursos, asignaciones,
--   matriculas, matriculas_curso), notas, asistencia, tareas, eventos,
--   mensajes e instituciones.
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
DROP TABLE IF EXISTS matriculas_curso;
DROP TABLE IF EXISTS matriculas;
DROP TABLE IF EXISTS asignaciones;
DROP TABLE IF EXISTS grupos; -- legado pre-008 (ver 008_colegios.sql)
DROP TABLE IF EXISTS materias; -- legado pre-008
DROP TABLE IF EXISTS carreras_grados; -- legado pre-008
DROP TABLE IF EXISTS cursos;
DROP TABLE IF EXISTS asignaturas;
DROP TABLE IF EXISTS grados;
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
-- grados: grados escolares ofrecidos por la institución (preescolar, primaria,
-- secundaria y media). `orden` permite listarlos de menor a mayor (ej. 6).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  nivel ENUM('preescolar','primaria','secundaria','media') NOT NULL DEFAULT 'primaria',
  orden INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- asignaturas: áreas/asignaturas dictadas en un grado (ej. Matemáticas de 6°).
-- `codigo` es un alias corto y opcional (ej. MAT-6).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaturas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(20) DEFAULT NULL,
  grado_id INT DEFAULT NULL,
  CONSTRAINT fk_asignaturas_grado
    FOREIGN KEY (grado_id) REFERENCES grados(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- cursos: cada sección de un grado en un año lectivo (ej. 6A de 2026), con su
-- director de grupo (docente). Los estudiantes se matriculan al curso por año.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grado_id INT NOT NULL,
  nombre VARCHAR(10) NOT NULL,
  director_id INT DEFAULT NULL,
  ano_lectivo INT NOT NULL,
  CONSTRAINT fk_cursos_grado
    FOREIGN KEY (grado_id) REFERENCES grados(id) ON DELETE CASCADE,
  CONSTRAINT fk_cursos_director
    FOREIGN KEY (director_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- asignaciones: una asignatura dictada a un curso por un docente en un periodo
-- del año lectivo. `periodo` usa el formato AAAA-PN (ej. 2026-P1, P1..P4).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  asignatura_id INT NOT NULL,
  docente_id INT NOT NULL,
  periodo VARCHAR(20) NOT NULL,
  horario VARCHAR(120) DEFAULT NULL,
  CONSTRAINT fk_asignaciones_curso
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  CONSTRAINT fk_asignaciones_asignatura
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE,
  CONSTRAINT fk_asignaciones_docente
    FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- matriculas_curso: matrícula anual de un estudiante a un curso (ej. 6A 2026).
-- Al matricular, el sistema genera las matriculas por asignación del curso.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matriculas_curso (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  curso_id INT NOT NULL,
  ano_lectivo INT NOT NULL,
  fecha_matricula DATE NOT NULL,
  UNIQUE KEY uq_matricula_curso (estudiante_id, curso_id),
  CONSTRAINT fk_matriculas_curso_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_matriculas_curso_curso
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- matriculas: vinculan a un estudiante con una asignación (asignatura de su
-- curso en un periodo). Se generan automáticamente desde la matrícula anual.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matriculas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  asignacion_id INT NOT NULL,
  fecha_matricula DATE NOT NULL,
  UNIQUE KEY uq_matricula (estudiante_id, asignacion_id),
  CONSTRAINT fk_matriculas_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_matriculas_asignacion
    FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE
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
-- tareas: actividades asignadas a una asignación (asignatura de un curso).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asignacion_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  fecha_entrega DATETIME DEFAULT NULL,
  puntaje_max DECIMAL(5,2) NOT NULL DEFAULT 10,
  CONSTRAINT fk_tareas_asignacion
    FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE
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
  CONSTRAINT fk_eventos_grado
    FOREIGN KEY (curso_id) REFERENCES grados(id) ON DELETE SET NULL
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