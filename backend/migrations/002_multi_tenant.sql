-- =============================================================================
-- Migración para soporte Multi-tenant (SaaS)
-- Agrega el rol 'superadmin' y la columna 'institucion_id' para aislamiento.
-- =============================================================================

USE academico;

-- 1. Ampliar el ENUM de roles para incluir 'superadmin'
ALTER TABLE usuarios MODIFY COLUMN rol ENUM('superadmin', 'admin', 'profesor', 'estudiante', 'acudiente') NOT NULL;

-- 1.1 Agregar estado a instituciones (para activar/desactivar colegios)
ALTER TABLE instituciones ADD COLUMN estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo';

-- 2. Agregar institucion_id a las tablas principales
-- usuarios (puede ser NULL para superadmin)
ALTER TABLE usuarios ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL;

-- grados
ALTER TABLE grados ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE grados ADD CONSTRAINT fk_grados_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- asignaturas
ALTER TABLE asignaturas ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE asignaturas ADD CONSTRAINT fk_asignaturas_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- cursos
ALTER TABLE cursos ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE cursos ADD CONSTRAINT fk_cursos_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- asignaciones
ALTER TABLE asignaciones ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE asignaciones ADD CONSTRAINT fk_asignaciones_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- matriculas_curso
ALTER TABLE matriculas_curso ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE matriculas_curso ADD CONSTRAINT fk_matriculas_curso_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- matriculas
ALTER TABLE matriculas ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE matriculas ADD CONSTRAINT fk_matriculas_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- eventos_calendario
ALTER TABLE eventos_calendario ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE eventos_calendario ADD CONSTRAINT fk_eventos_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- mensajes
ALTER TABLE mensajes ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE mensajes ADD CONSTRAINT fk_mensajes_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- tareas
ALTER TABLE tareas ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE tareas ADD CONSTRAINT fk_tareas_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- notificaciones
ALTER TABLE notificaciones ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE notificaciones ADD CONSTRAINT fk_notificaciones_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- 3. Asignar datos existentes a la primera institución encontrada (si existe)
-- Esto evita errores de integridad en datos huerfanos.
SET @first_inst = (SELECT id FROM instituciones LIMIT 1);
UPDATE usuarios SET institucion_id = @first_inst WHERE rol <> 'superadmin' AND institucion_id IS NULL;
UPDATE grados SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE asignaturas SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE cursos SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE asignaciones SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE matriculas_curso SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE matriculas SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE eventos_calendario SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE mensajes SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE tareas SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE notificaciones SET institucion_id = @first_inst WHERE institucion_id IS NULL;

-- 4. Hacer institucion_id NOT NULL donde sea obligatorio (excepto usuarios para superadmin)
ALTER TABLE grados MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE asignaturas MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE cursos MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE asignaciones MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE matriculas_curso MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE matriculas MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE mensajes MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE tareas MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE notificaciones MODIFY COLUMN institucion_id INT NOT NULL;
