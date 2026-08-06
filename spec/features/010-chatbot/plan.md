# 010 · Chatbot SIA — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Asistente basado en reglas y consultas a la BD del usuario, sin LLM: `backend/routes/chatbot.js` recibe la pregunta, la "entiende" por palabras clave/tipos de intención y ejecuta la consulta SQL del estudiante logueado; el frontend (`ChatbotWidget.tsx`) muestra el diálogo flotante. Las mismas consultas alimentan las features 004, 005, 006 y 009, así que la información es idéntica en todas las pantallas.

## Implementación

1. **API** — `backend/routes/chatbot.js`: ruta protegida `POST /` que recibe `{ pregunta }` y devuelve `{ respuesta }`. Clasifica la intención por palabras clave: notas, promedio, tareas, asistencia, reuniones/eventos.
2. **Consultas** — se reutilizan las sentencias preparadas de los routers de estudiante: `estudiante.js` (notas/promedio/asistencia), `tareas.js` (por vencer), `calendario.js` (reuniones próximas).
3. **Fallback** — intención no reconocida responde con ayuda genérica y orientación al administrador.
4. **Widget** — `frontend/src/components/ChatbotWidget.tsx`: botón flotante, burbujas de conversación y estado del usuario; si no hay intención clara, sugiere ejemplos de preguntas.
5. **Privacidad** — todos los datos respondidos salen de `req.user.id`; nunca de otros usuarios.

## Decisiones

- **Base de reglas sin LLM** — el alcance es acotado (preguntas académicas), un clasificador simple es determinista y gratis, sin exponer datos a terceros (se descartó llamar a una API de IA: costosa e incompatible con red local sin internet).
- **Reutilizar el SQL de otras features** — misma lógica que las pantallas para garantizar respuestas consistentes.
- **Sin persistencia del chat** — el historial vive en el estado del widget (se descartó guardar conversaciones: no aportan al negocio).

## Riesgos

- **Pregunta mal interpretada** — mitigado con la lista de preguntas de ejemplos que el widget sugiere y respuesta de fallback amable.
- **Consultas lentas si crece la BD** — las consultas usan los índices/llaves existentes y filtran por `usuario_id`; escala para el tamaño previsto.