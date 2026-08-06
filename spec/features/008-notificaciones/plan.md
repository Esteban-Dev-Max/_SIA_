# 008 · Notificaciones — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Tabla `notificaciones` con `tipo` (ENUM) y `leida`. La creación se centraliza en `backend/lib/notificar.js` (`notificar(usuario_id, titulo, mensaje, tipo)`), que se invoca desde los routers que producen eventos. La campana del frontend (`NotificationBell.tsx`) consulta no leídas con React Query y un intervalo de 60 s.

## Implementación

1. **Helper** — `backend/lib/notificar.js`: INSERT en `notificaciones` con `leida = 0`; recibe título, mensaje y tipo.
2. **Emisión** — llamadas desde `routes/notas.js` (nota publicada), `routes/tareas.js` (tarea asignada y entrega calificada), `routes/mensajes.js` (mensaje nuevo), `routes/calendario.js`/`admin.js` (evento creado) y casos generales (sistema).
3. **API de consulta** — `backend/routes/notificaciones.js`: listar las del usuario (`req.user.id`) con estado, y marcar como leída una o todas.
4. **Campana** — `frontend/src/components/NotificationBell.tsx`: contador de no leídas, menú con las últimas y acción de marcar leídas; `refetchInterval: 60_000` en React Query. Se integra en el `PanelShell`.
5. **RBAC** — ruta protegida con `verifyToken`; un usuario solo ve sus filas (`WHERE usuario_id = req.user.id`).

## Decisiones

- **Polling de 60 s en lugar de WebSocket** — suficiente para el ámbito de red local, cero infraestructura extra (se descartó socket.io/SSE).
- **Tipo ENUM fijo** — los cinco tipos están en la BD; ayuda a que la UI agrupe por icono/color sin free-text.
- **Leída global por usuario** — marcar todas se resuelve con un único UPDATE filtrado por `usuario_id`.

## Riesgos

- **Inundación de notificaciones** — cada evento relevante genera una fila; sin límite por usuario, el polling las arrastra todas (aceptado por el volumen del sistema).
- **Notificación para usuario inexistente** — `notificar` falla silenciosamente por FK si el destino fue eliminado; se llama solo con usuarios vigentes desde el flujo de negocio.