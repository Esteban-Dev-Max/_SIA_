# 011 · Portal acudiente

**Estado:** implementado ✅

## Qué hace

Panel para el acudiente (`/acudiente`) con el monitoreo académico de cada estudiante vinculado: notas ponderadas por materia, definitiva, promedio y materias cursadas; alertas de inasistencia con conteo de ausencias y el historial detallado; y un boletín imprimible (el navegador exporta a PDF).

## Por qué

Da a los acudientes visibilidad del rendimiento y la asistencia de sus hijos sin depender del estudiante ni de reuniones: detecta ausencias repetidas y baja de notas a tiempo.

## Criterios de aceptación

- [x] El acudiente ve el listado de los estudiantes vinculados en `acudiente_estudiante` y puede alternar entre ellos.
- [x] El resumen por estudiante muestra las notas ponderadas por materia, la definitiva y el promedio.
- [x] Las fallas se cuentan como ausente + tarde, y el detalle del historial de asistencia es visible.
- [x] La tasa de asistencia se calcula en el backend.
- [x] Pulsar imprimir genera el boletín (PDF vía impresión del navegador) con el contenido académico del estudiante seleccionado.
- [x] El rol `acudiente` no accede a rutas de otros roles (403/redirección).
- [x] Los cálculos usan la misma ponderación 25/25/20/30 de la feature 004.

## Fuera de alcance

- Boletín PDF generado por servidor (en backlog).
- Mensajería dirigida a acudientes desde el sistema (usan la mensajería general).
- Múltiples estudiantes compartidos con permiso de edición.