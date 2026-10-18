-- ---------------------------------------------------------------------------
-- 007_quitar_creditos: elimina la columna creditos de materias.
-- La función de créditos se retiró del sistema (ya no se usa en la UI ni API).
-- Condicional: en un migrate fresco la 001 ya crea la tabla sin la columna,
-- así que solo se elimina si todavía existe (BDs creadas antes de este cambio).
-- Se usa DATABASE() para que funcione tanto en `academico` (migrate/seed)
-- como en `academico_test` (tests/setup-db.js).
-- ---------------------------------------------------------------------------
SET @existe_creditos := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'materias'
    AND COLUMN_NAME = 'creditos'
);
SET @sql_quitar_creditos := IF(
  @existe_creditos > 0,
  'ALTER TABLE materias DROP COLUMN creditos',
  'SELECT 1'
);
PREPARE stmt_quitar_creditos FROM @sql_quitar_creditos;
EXECUTE stmt_quitar_creditos;
DEALLOCATE PREPARE stmt_quitar_creditos;
