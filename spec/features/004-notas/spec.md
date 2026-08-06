# 004 · Notas

**Estado:** implementado ✅

## Qué hace

El profesor (y el admin como respaldo) registra las cuatro calificaciones por estudiante y grupo: nota 1, nota 2, nota 3 y examen final. El sistema calcula automáticamente la definitiva con la ponderación 25% + 25% + 20% + 30% (se aprueba con 3.0) y la publica al estudiante en tiempo real junto con su promedio general. El estudiante ve sus notas por materia y el acudiente el promedio ponderado de sus vinculados.

## Por qué

Es el corazón académico del sistema: reemplaza las planillas en papel y evita errores de cálculo manual, garantizando que el estudiante y su acudiente vean exactamente el mismo resultado que el profesor.

## Criterios de aceptación

- [x] La API rechaza calificaciones fuera del rango 0-5 o no numéricas con 400 y mensaje en español.
- [x] La definitiva se calcula en el servidor con la fórmula 25/25/20/30 y se redondea a 2 decimales.
- [x] Un profesor solo registra notas de los grupos en los que aparece como profesor del grupo.
- [x] El estudiante ve sus notas y definitivas actualizadas sin recargar manualmente (consulta en tiempo real).
- [x] El promedio general del estudiante usa las definitivas de todas sus materias.
- [x] Guardar notas emite una notificación de tipo `nota` al estudiante.
- [x] Las observaciones opcionales se guardan y se muestran junto a la nota.
- [x] La ponderación es idéntica en `backend/routes/notas.js` y `backend/seed.js`.

## Fuera de alcance

- Historial de versiones de calificaciones (auditoría de cambios).
- Escalas de calificación configurables por institución (la ponderación es fija).