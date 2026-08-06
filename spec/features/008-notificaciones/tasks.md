# 008 · Notificaciones — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] Crear `backend/lib/notificar.js` como único punto de creación de notificaciones.
- [x] Emitir notificaciones desde notas, tareas, mensajes, calendario y avisos de sistema.
- [x] Implementar `backend/routes/notificaciones.js` (listar, marcar una, marcar todas).
- [x] Implementar `frontend/src/components/NotificationBell.tsx` con polling de 60 s integrado en `PanelShell`.
- [x] Mostrar el tipo con icono y color (sistema, nota, tarea, mensaje, evento).
- [x] Validar: generación de alerta al publicar nota, conteo no leídas y borrado del contador al marcar.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.