-- =============================================================================
-- Migración: Trazabilidad y auditoría de asistencia
-- 1) usuarios.codigo_carnet: identificador único imprimible (carné QR).
-- 2) asistencia: quién marcó (marcado_por), hora de marcación y última edición.
-- 3) asistencia_audit: bitácora de cambios (quién, cuándo, justificación).
-- =============================================================================

USE academico;

-- Carné QR único por estudiante (NULL para roles que no son estudiantes).
ALTER TABLE usuarios
  ADD COLUMN codigo_carnet VARCHAR(40) DEFAULT NULL UNIQUE;

-- Backfill determinístico para estudiantes sin carné: S + id en 6 dígitos.
UPDATE usuarios
  SET codigo_carnet = CONCAT('S', LPAD(id, 6, '0'))
  WHERE rol = 'estudiante' AND codigo_carnet IS NULL;

-- Trazabilidad sobre cada marca de asistencia: quién y cuándo se registró/editó.
ALTER TABLE asistencia
  ADD COLUMN marcado_por INT NULL,
  ADD COLUMN hora_marcado DATETIME NULL,
  ADD COLUMN actualizado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  ADD CONSTRAINT fk_asistencia_marcado_por
    FOREIGN KEY (marcado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- Bitácora de ediciones. La justificación solo se exige al editar días pasados.
CREATE TABLE IF NOT EXISTS asistencia_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL,
  fecha DATE NOT NULL,
  estado_anterior VARCHAR(20) DEFAULT NULL,
  estado_nuevo VARCHAR(20) NOT NULL,
  justificacion VARCHAR(500) DEFAULT NULL,
  usuario_id INT NOT NULL,
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_matricula_fecha (matricula_id, fecha),
  CONSTRAINT fk_audit_matricula
    FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;