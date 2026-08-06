# 007 · Mensajería interna — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Chat individual modelado en la tabla `mensajes` (remitente, destinatario, contenido, `leido`, fecha). El router `backend/routes/mensajes.js` expone envío, listado de conversaciones y de mensajes; el frontend (`frontend/src/routes/mensajes.tsx`) ofrece un selector de destinatario y la vista de conversación. Cada mensaje nuevo dispara una notificación de tipo `mensaje` al destinatario.

## Implementación

1. **API** — `routes/mensajes.js`: `GET /conversaciones` (usuarios con quien se ha hablado y último mensaje/no leídos), `GET /:id` (historial remitente↔destinatario, sin restricción: cada parte solo ve la suya) y `POST /` (crear mensaje validando usuarios existentes).
2. **Leídos** — al consultar el historial se marcan como leídos los entrantes del destinatario (`UPDATE mensajes SET leido = 1 WHERE destinatario_id = ? AND remitente_id = ? AND leido = 0`).
3. **Frontend** — `frontend/src/routes/mensajes.tsx`: lista de conversaciones a la izquierda, hilo al centro y envío; busqueda del destinatario por nombre/correo. `NotificationBell` contabiliza los avisos tipo `mensaje`.
4. **Seguridad** — el historial solo se devuelve a remitente o destinatario (`req.user.id`); terceros reciben 403.

## Decisiones

- **Modelo plano 1:1, sin salas** — una tabla `mensajes` con dos IDs basta para la escala del sistema (se descartó tablas de hilos/grupos).
- **`leido` como flag en la fila** — actualización simple al abrir la conversación; sin timestamps de lectura adicionales.
- **Polling por React Query** — el refresco de no leídos usa el mismo polling de 60 s de las notificaciones, sin WebSocket.

## Riesgos

- **Concurrencia de leídos** — dos pestañas marcando leídos pueden competir; el UPDATE es inofensivo (idempotente).
- **Crecimiento de mensajes** — sin paginar, los hilos muy largos podrían pesar; se descartó paginación por simplicidad en esta fase.