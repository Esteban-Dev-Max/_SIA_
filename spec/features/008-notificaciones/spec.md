# 008 · Notificaciones

**Estado:** implementado ✅

## Qué hace

Campana en la cabecera del panel con las notificaciones no leídas del usuario, actualizadas por polling cada 60 segundos. Las alertas se generan automáticamente desde la API cuando ocurre un evento relevante: calificación publicada (nota), tarea creada/calificada (tarea), mensaje nuevo (mensaje), evento institucional (evento) y avisos generales (sistema). El usuario marca como leídas las que revisa.

## Por qué

Es el canal que mantiene informados a estudiantes y acudientes sin revisar cada pantalla: el estudiante se entera de la nota publicada o de la tarea por vencer, y el acudiente de los mensajes del docente.

## Criterios de aceptación

- [x] Existen los cinco tipos: sistema, nota, tarea, mensaje y evento.
- [x] Publicar notas, calificar entregas, enviar mensajes y crear eventos genera la notificación correspondiente al usuario afectado.
- [x] La campana muestra el número de no leídas y la lista completa con su tipo.
- [x] El conteo se actualiza por polling cada 60 s sin recargar la página.
- [x] Marcar una notificación como leída la quita del contador.
- [x] Un usuario solo ve sus propias notificaciones.
- [x] El helper `backend/lib/notificar.js` es el único punto de creación (una llamada, un INSERT).

## Fuera de alcance

- Notificaciones push del navegador o por correo.
- WebSocket/SSE en tiempo real (el polling de 60 s es el mecanismo del sistema).
- Preferencias por tipo de notificación.