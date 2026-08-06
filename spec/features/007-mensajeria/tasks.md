# 007 · Mensajería interna — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] Implementar `backend/routes/mensajes.js` (crear, listar conversaciones, historial y marcar leídos).
- [x] Restringir el historial a remitente/destinatario (403 a terceros).
- [x] Crear la notificación tipo `mensaje` al destinatario en cada envío.
- [x] Implementar `frontend/src/routes/mensajes.tsx` (selector de destinatario, conversaciones e hilo).
- [x] Conectar el contador de no leídos con la campana de notificaciones.
- [x] Validar: envío entre dos roles, reflejo de no leídos y restricción de acceso.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.