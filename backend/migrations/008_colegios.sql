-- ---------------------------------------------------------------------------
-- 008_colegios: adapta el modelo de instituto/universidad al de colegio.
--   carreras_grados -> grados (+ nivel, + orden, - codigo)
--   materias        -> asignaturas (carrera_id -> grado_id)
--   grupos          -> asignaciones (materia_id -> asignatura_id,
--                    profesor_id -> docente_id, - codigo_grupo, + curso_id)
--   matriculas.grupo_id -> matriculas.asignacion_id
--   tareas.grupo_id     -> tareas.asignacion_id
--   + tablas nuevas: cursos (grado + letra + director + año lectivo) y
--     matriculas_curso (matrícula anual del estudiante al curso).
-- Cada paso es condicional: en un migrate fresco la 001 ya crea el esquema
-- nuevo y esta migración no hace nada. Se usa DATABASE() para que funcione
-- tanto en `academico` (migrate) como en `academico_test` (tests/setup-db.js).
-- Compatible con MariaDB 10.4 (sin RENAME COLUMN: se usa CHANGE COLUMN con
-- la definición completa, soltando y recreando las claves foráneas).
-- ---------------------------------------------------------------------------

-- 1) carreras_grados -> grados ---------------------------------------------
SET @tiene_carreras := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'carreras_grados'
);
SET @sql := IF(@tiene_carreras > 0, 'RENAME TABLE carreras_grados TO grados', 'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_grados := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grados'
);
SET @tiene_nivel := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grados' AND COLUMN_NAME = 'nivel'
);
SET @sql := IF(@tiene_grados > 0 AND @tiene_nivel = 0,
  'ALTER TABLE grados ADD COLUMN nivel ENUM(''preescolar'',''primaria'',''secundaria'',''media'') NOT NULL DEFAULT ''secundaria'', ADD COLUMN orden INT NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_codigo_grado := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grados' AND COLUMN_NAME = 'codigo'
);
SET @sql := IF(@tiene_grados > 0 AND @tiene_codigo_grado > 0,
  'ALTER TABLE grados DROP COLUMN codigo',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 2) materias -> asignaturas ------------------------------------------------
SET @tiene_materias := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materias'
);
SET @sql := IF(@tiene_materias > 0, 'RENAME TABLE materias TO asignaturas', 'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_asignaturas := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaturas'
);
SET @tiene_fk_mc := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaturas'
    AND CONSTRAINT_NAME = 'fk_materias_carrera'
);
SET @sql := IF(@tiene_asignaturas > 0 AND @tiene_fk_mc > 0,
  'ALTER TABLE asignaturas DROP FOREIGN KEY fk_materias_carrera',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_carrera_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaturas' AND COLUMN_NAME = 'carrera_id'
);
SET @sql := IF(@tiene_asignaturas > 0 AND @tiene_carrera_id > 0,
  'ALTER TABLE asignaturas CHANGE COLUMN carrera_id grado_id INT DEFAULT NULL, ADD CONSTRAINT fk_asignaturas_grado FOREIGN KEY (grado_id) REFERENCES grados(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_unique_codigo := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaturas' AND INDEX_NAME = 'codigo'
);
SET @sql := IF(@tiene_asignaturas > 0 AND @tiene_unique_codigo > 0,
  'ALTER TABLE asignaturas DROP INDEX codigo, MODIFY COLUMN codigo VARCHAR(20) DEFAULT NULL',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 3) Tablas nuevas: cursos y matriculas_curso -------------------------------
CREATE TABLE IF NOT EXISTS cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grado_id INT NOT NULL,
  nombre VARCHAR(10) NOT NULL,
  director_id INT DEFAULT NULL,
  ano_lectivo INT NOT NULL,
  institucion_id INT NOT NULL,
  CONSTRAINT fk_cursos_grado
    FOREIGN KEY (grado_id) REFERENCES grados(id) ON DELETE CASCADE,
  CONSTRAINT fk_cursos_director
    FOREIGN KEY (director_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_cursos_institucion
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matriculas_curso (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  curso_id INT NOT NULL,
  ano_lectivo INT NOT NULL,
  fecha_matricula DATE NOT NULL,
  institucion_id INT NOT NULL,
  UNIQUE KEY uq_matricula_curso (estudiante_id, curso_id),
  CONSTRAINT fk_matriculas_curso_estudiante
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_matriculas_curso_curso
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
  CONSTRAINT fk_matriculas_curso_institucion
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4) grupos -> asignaciones -------------------------------------------------
SET @tiene_grupos := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grupos'
);
SET @sql := IF(@tiene_grupos > 0, 'RENAME TABLE grupos TO asignaciones', 'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_asignaciones := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones'
);
SET @tiene_fk_gm := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones'
    AND CONSTRAINT_NAME = 'fk_grupos_materia'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_fk_gm > 0,
  'ALTER TABLE asignaciones DROP FOREIGN KEY fk_grupos_materia',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_fk_gp := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones'
    AND CONSTRAINT_NAME = 'fk_grupos_profesor'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_fk_gp > 0,
  'ALTER TABLE asignaciones DROP FOREIGN KEY fk_grupos_profesor',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_fk_gi := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones'
    AND CONSTRAINT_NAME = 'fk_grupos_institucion'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_fk_gi > 0,
  'ALTER TABLE asignaciones DROP FOREIGN KEY fk_grupos_institucion',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_materia_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones' AND COLUMN_NAME = 'materia_id'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_materia_id > 0,
  'ALTER TABLE asignaciones CHANGE COLUMN materia_id asignatura_id INT NOT NULL',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_profesor_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones' AND COLUMN_NAME = 'profesor_id'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_profesor_id > 0,
  'ALTER TABLE asignaciones CHANGE COLUMN profesor_id docente_id INT NOT NULL',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_ficha := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones' AND COLUMN_NAME = 'codigo_grupo'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_ficha > 0,
  'ALTER TABLE asignaciones DROP COLUMN codigo_grupo',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_curso_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones' AND COLUMN_NAME = 'curso_id'
);
SET @sql := IF(@tiene_asignaciones > 0 AND @tiene_curso_id = 0,
  'ALTER TABLE asignaciones ADD COLUMN curso_id INT DEFAULT NULL, ADD CONSTRAINT fk_asignaciones_curso FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE, ADD CONSTRAINT fk_asignaciones_asignatura FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE, ADD CONSTRAINT fk_asignaciones_docente FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE, ADD CONSTRAINT fk_asignaciones_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 5) matriculas.grupo_id -> matriculas.asignacion_id -------------------------
SET @tiene_fk_mg := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matriculas'
    AND CONSTRAINT_NAME = 'fk_matriculas_grupo'
);
SET @sql := IF(@tiene_fk_mg > 0,
  'ALTER TABLE matriculas DROP FOREIGN KEY fk_matriculas_grupo',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_mat_grupo := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matriculas' AND COLUMN_NAME = 'grupo_id'
);
SET @sql := IF(@tiene_mat_grupo > 0,
  'ALTER TABLE matriculas CHANGE COLUMN grupo_id asignacion_id INT NOT NULL, ADD CONSTRAINT fk_matriculas_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 6) tareas.grupo_id -> tareas.asignacion_id ---------------------------------
SET @tiene_fk_tg := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tareas'
    AND CONSTRAINT_NAME = 'fk_tareas_grupo'
);
SET @sql := IF(@tiene_fk_tg > 0,
  'ALTER TABLE tareas DROP FOREIGN KEY fk_tareas_grupo',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tiene_tar_grupo := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tareas' AND COLUMN_NAME = 'grupo_id'
);
SET @sql := IF(@tiene_tar_grupo > 0,
  'ALTER TABLE tareas CHANGE COLUMN grupo_id asignacion_id INT NOT NULL, ADD CONSTRAINT fk_tareas_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 7) eventos_calendario.curso_id ahora apunta a grados ------------------------
SET @tiene_fk_ev := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'eventos_calendario'
    AND CONSTRAINT_NAME = 'fk_eventos_carrera'
);
SET @sql := IF(@tiene_fk_ev > 0,
  'ALTER TABLE eventos_calendario DROP FOREIGN KEY fk_eventos_carrera, ADD CONSTRAINT fk_eventos_grado FOREIGN KEY (curso_id) REFERENCES grados(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
