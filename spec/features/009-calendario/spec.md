# 009 · Calendario

**Estado:** implementado ✅

## Qué hace

Vista mensual y semanal del calendario académico con dos tipos de contenido: los eventos institucionales (evaluaciones, reuniones, entregas, eventos) creados por el admin, y las tareas con fecha límite de los grupos del usuario. El alcance depende del rol: el estudiante ve sus tareas, el profesor las de sus grupos y el admin gestiona los eventos.

## Por qué

Es el punto único para saber "qué hay esta semana": une lo institucional y lo personal en una sola pantalla y reduce las dudas de fechas que hoy se resuelven preguntando.

## Criterios de aceptación

- [x] Existen los tipos de evento: institucional, evaluación, entrega y reunión, distinguibles en la UI.
- [x] El admin puede crear, editar y borrar eventos con fecha de inicio/fin y descripción.
- [x] El estudiante ve sus tareas por vencer junto a los eventos; el profesor ve las de sus grupos.
- [x] Las vistas mensual y semanal muestran los mismos datos desde la misma API.
- [x] La fecha límite de la tarea proviene de `tareas.fecha_entrega` (misma fuente que el listado de tareas).
- [x] Crear un evento emite una notificación de tipo `evento`.
- [x] El chatbot usa los eventos de reunión de la misma consulta para responder preguntas.

## Fuera de alcance

- Calendarios personales por usuario o reservas de espacios.
- Sincronización con Google Calendar / ICS.
- Arrastrar y soltar para reprogramar eventos.