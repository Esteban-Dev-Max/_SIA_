# 005 · Asistencia — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

La asistencia es un registro diario por matrícula: una fila en `asistencia` por (matrícula, fecha) con un estado de un ENUM fijo y observación opcional. El profesor la toma grupo por grupo; el estudiante y el acudiente consultan historial y porcentajes agregados. Todo el cálculo de porcentajes ocurre en el backend sobre la misma fuente de verdad.

## Implementación

1. **Toma de asistencia** — `backend/routes/asistencia.js` (y el flujo en `profesor.js`): recibe grupo, fecha y los estados por alumno; usa `INSERT ... ON DUPLICATE KEY UPDATE` para que repetir el mismo día actualice en lugar de duplicar (clave única matrícula+fecha).
2. **Consulta profesor** — lista del grupo con su estado del día para marcar presente/ausente/tarde/excusa.
3. **Consulta estudiante** — `backend/routes/estudiante.js`: total de fallas (ausente + tarde), porcentaje de asistencia y detalle por materia; UI en `estudiante/index.tsx`.
4. **Consulta acudiente** — `backend/routes/acudiente.js`: conteo de ausencias y el historial de cada estudiante vinculado; UI en `acudiente/index.tsx`.
5. **Permisos** — el profesor solo toma asistencia de los grupos que imparte (validado por `grupos.profesor_id`).

## Decisiones

- **Upsert por (matrícula, fecha)** — el estado diario es único; volver a guardar el mismo día actualiza en lugar de crear duplicados.
- **ENUM en BD** — los estados (`presente|ausente|tarde|excusa`) se validan en la BD y en la API; desconocidos responden 400.
- **"Ausencia" cuenta 'ausente' y 'tarde'** — regla de negocio aplicada consistentemente en estudiante y acudiente.

## Riesgos

- **Código de profesor incorrecto** — mitigado al validar la pertenencia al grupo antes de aceptar la toma.
- **Zona horaria** — la fecha viene explícita del profesor (columna DATE), se evita confiar en `NOW()` para no cruzar días alrededor de la medianoche.