-- =============================================================================
-- Migración: Recuperación de contraseña por correo
-- Agrega la tabla password_resets para guardar los tokens de restablecimiento
-- (hash sha256, solo el hash viaja a la BD) con su fecha de expiración y uso.
-- =============================================================================

USE academico;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;