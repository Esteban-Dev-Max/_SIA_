-- ---------------------------------------------------------------------------
-- 009_matricula_unica_ano: impide que un estudiante se matricule en más de un
-- curso dentro del mismo año lectivo (una matrícula anual por estudiante).
--
-- 1) Limpia duplicados existentes por (estudiante_id, ano_lectivo,
--    institucion_id), conservando la matrícula más reciente (MAX(id)).
--    Las matrículas por asignatura del curso descartado se eliminan también
--    (notas y asistencia caen por ON DELETE CASCADE).
-- 2) Agrega un índice único que garantiza la regla a nivel de esquema.
-- ---------------------------------------------------------------------------

USE academico;

-- 1) Eliminar matrículas anuales duplicadas conservando la más reciente.
DELETE mc FROM matriculas_curso mc
JOIN (
  SELECT estudiante_id, ano_lectivo, institucion_id, MAX(id) AS keep_id
  FROM matriculas_curso
  GROUP BY estudiante_id, ano_lectivo, institucion_id
  HAVING COUNT(*) > 1
) d ON d.estudiante_id = mc.estudiante_id
   AND d.ano_lectivo = mc.ano_lectivo
   AND d.institucion_id = mc.institucion_id
   AND mc.id <> d.keep_id;

-- Matrículas por asignatura de esos cursos descartados (si quedaron huérfanas,
-- sin una matrícula anual que las respalde).
DELETE mat FROM matriculas mat
JOIN asignaciones a ON a.id = mat.asignacion_id
WHERE NOT EXISTS (
  SELECT 1 FROM matriculas_curso mc
  WHERE mc.estudiante_id = mat.estudiante_id
    AND mc.curso_id = a.curso_id
    AND mc.ano_lectivo = (
      SELECT c.ano_lectivo FROM cursos c WHERE c.id = a.curso_id
    )
    AND mc.institucion_id = mat.institucion_id
);

-- 2) Restricción única de matrícula anual por estudiante.
SET @tiene_uq_estudiante_ano := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'matriculas_curso'
    AND INDEX_NAME = 'uq_matricula_estudiante_ano'
);
SET @sql := IF(
  @tiene_uq_estudiante_ano = 0,
  'ALTER TABLE matriculas_curso ADD UNIQUE KEY uq_matricula_estudiante_ano (estudiante_id, ano_lectivo, institucion_id)',
  'SELECT 1'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
