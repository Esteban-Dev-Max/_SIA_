# 004 · Notas — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Las notas viven en una tabla propia (`notas`, una fila por matrícula) y la definitiva se calcula **en el servidor** con la ponderación fija del proyecto: nota 1 (25%) + nota 2 (25%) + nota 3 (20%) + examen final (30%). La API expone el registro para profesor/admin y la consulta para estudiante/acudiente; cada publicación de nota emite una notificación al estudiante.

## Implementación

1. **API de notas** — `backend/routes/notas.js`: actualiza `notas.nota_1..examen_final` por matrícula, recalcula `nota_definitiva` con la fórmula ponderada (redondeo a 2 decimales) y guarda `observaciones`. Valida rangos 0-5 y que el profesor pertenezca al grupo.
2. **Consulta profesor** — `backend/routes/profesor.js` y `backend/routes/admin.js`: listan grupos con sus alumnos y notas (planilla). `backend/routes/estudiante.js` expone las notas del estudiante con definitiva y promedio general; `backend/routes/acudiente.js` agrega el promedio ponderado por materia de los vinculados.
3. **Planilla en la UI** — `frontend/src/routes/profesor/index.tsx`: selección de grupo y edición de notas por estudiante con recálculo visible; `frontend/src/routes/estudiante/index.tsx`: tarjetas por materia con nota 1/2/3, examen, definitiva y promedio; `admin/index.tsx` reutiliza la planilla.
4. **Notificaciones** — al guardar notas se llama a `notificar(estudiante_id, ...)` con tipo `nota`.

## Decisiones

- **Cálculo en el servidor** — el navegador no define la definitiva; la fórmula vive en `routes/notas.js` y se duplica en `seed.js` para datos coherentes (regla de la constitución: mantener ambas sincronizadas).
- **Tabla 1:1 con matrícula** — `notas.matricula_id` es UNIQUE: una calificación por matrícula, sin historial por periodo extra (se descartó versionado de notas).
- **Aprobación con 3.0** — criterio institucional fijo aplicado en la UI y el backend.
- **Rango 0-5 con 2 decimales** — `DECIMAL(5,2)` en BD; la API valida entradas inválidas con 400.

## Riesgos

- **Ponderación desincronizada** — si solo se cambia en un archivo, los datos demo y la API difieren; mitigado con la regla explícita de la constitución.
- **Notas nulas** — estudiantes sin calificaciones completas: la definitiva se calcula solo con los campos presentes (trata nulos como 0 en el backend) y la UI marca pendientes.