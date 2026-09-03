-- =============================================================================
-- Migración: Logo por Institución
-- Agrega columna logo_url a la tabla instituciones para branding multi-tenant.
-- =============================================================================

USE academico;

-- Agregar columna logo_url a instituciones
ALTER TABLE instituciones 
ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL AFTER estado;

-- =============================================================================