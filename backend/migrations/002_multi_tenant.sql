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

-- carreras_grados
ALTER TABLE carreras_grados ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE carreras_grados ADD CONSTRAINT fk_carreras_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- materias
ALTER TABLE materias ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE materias ADD CONSTRAINT fk_materias_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

-- grupos
ALTER TABLE grupos ADD COLUMN institucion_id INT DEFAULT NULL;
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;

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
UPDATE carreras_grados SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE materias SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE grupos SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE matriculas SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE eventos_calendario SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE mensajes SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE tareas SET institucion_id = @first_inst WHERE institucion_id IS NULL;
UPDATE notificaciones SET institucion_id = @first_inst WHERE institucion_id IS NULL;

-- 4. Hacer institucion_id NOT NULL donde sea obligatorio (excepto usuarios para superadmin)
ALTER TABLE carreras_grados MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE materias MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE grupos MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE matriculas MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE mensajes MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE tareas MODIFY COLUMN institucion_id INT NOT NULL;
ALTER TABLE notificaciones MODIFY COLUMN institucion_id INT NOT NULL;
