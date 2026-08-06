# 010 · Chatbot SIA — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] Implementar `backend/routes/chatbot.js` con clasificación por palabras clave y consultas del estudiante logueado.
- [x] Cubrir intenciones: notas, promedio, tareas, asistencia y reuniones/eventos.
- [x] Respuesta de fallback amable para preguntas no reconocidas.
- [x] Implementar `frontend/src/components/ChatbotWidget.tsx` (widget flotante, burbujas y ayuda con ejemplos).
- [x] Garantizar que todas las respuestas usan solo `req.user.id`.
- [x] Validar: cada intención con el estudiante demo y privacidad (otro usuario no recibe datos ajenos).
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.