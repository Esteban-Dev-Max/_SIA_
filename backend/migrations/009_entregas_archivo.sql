-- =============================================================================
-- Migración: adjuntos en las entregas de tareas
-- 1) entregas_tareas almacena el archivo subido (ruta, nombre original, MIME y
--    tamaño) además del enlace externo heredado (archivo_url).
-- 2) tardia: marca si la entrega se registró después de la fecha límite.
-- =============================================================================

USE academico;

ALTER TABLE entregas_tareas
  ADD COLUMN archivo_ruta VARCHAR(255) DEFAULT NULL,
  ADD COLUMN archivo_nombre VARCHAR(255) DEFAULT NULL,
  ADD COLUMN archivo_mime VARCHAR(120) DEFAULT NULL,
  ADD COLUMN archivo_tamano INT UNSIGNED DEFAULT NULL,
  ADD COLUMN tardia TINYINT(1) NOT NULL DEFAULT 0;
