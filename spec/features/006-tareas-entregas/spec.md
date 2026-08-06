# 006 · Tareas y entregas

**Estado:** implementado ✅

## Qué hace

El profesor crea tareas por grupo (título, descripción, fecha de entrega y puntaje máximo) y revisa las entregas de cada estudiante, que califica con retroalimentación. El estudiante ve las tareas de sus grupos con sus fechas de vencimiento, entrega un enlace de archivo con comentario y consulta su calificación.

## Por qué

Centraliza el ciclo completo de tareas — asignar, entregar y evaluar — y lo comunica con el calendario y las notificaciones, eliminando el "¿qué dejé?" y el seguimiento por mensajes sueltos.

## Criterios de aceptación

- [x] La tarea pertenece a un grupo y guarda título, descripción, fecha de entrega y puntaje máximo (10 por defecto).
- [x] Un estudiante solo ve y entrega tareas de los grupos en los que está matriculado.
- [x] La entrega es única por (tarea, estudiante): reentregar actualiza el registro existente.
- [x] El estudiante puede entregar enlace y comentario; el profesor puede calificar y dejar retroalimentación.
- [x] Calificar una entrega emite una notificación de tipo `tarea` al estudiante.
- [x] Las tareas próximas a vencer aparecen también en el calendario unificado (feature 009).
- [x] El profesor ve el estado de entrega de todo el grupo en una sola vista.

## Fuera de alcance

- Subida de archivos al servidor (`archivo_url` es un enlace externo en texto; la subida real está en backlog).
- Revisión automática de fechas límite o penalización por entrega tardía.