-- =============================================================================
-- Migración: Vínculo de tareas con la planilla de notas
-- Agrega 'columna_nota' a tareas: el rubro de la planilla (Nota 1, Nota 2,
-- Nota 3 o Examen Final) al que la calificación de la tarea se sincroniza
-- automáticamente. NULL = tarea sin vincular (comportamiento anterior).
-- =============================================================================

USE academico;

ALTER TABLE tareas
  ADD COLUMN columna_nota ENUM('nota_1', 'nota_2', 'nota_3', 'examen_final')
    DEFAULT NULL AFTER puntaje_max;