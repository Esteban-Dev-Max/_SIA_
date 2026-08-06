# 010 · Chatbot SIA

**Estado:** implementado ✅

## Qué hace

Widget de chat flotante disponible en los paneles que responde en español, en lenguaje natural, preguntas frecuentes del estudiante utilizando sus datos reales: notas y definitiva por materia, promedio general, tareas pendientes o por vencer, asistencia y fallas, y próximas reuniones o eventos. Se sirve sin conexión a servicios externos.

## Por qué

Reduce las consultas repetitivas a profesores y administración (¿qué nota tengo? ¿cuándo es la tarea?) autosirviendo al estudiante con la información precisa que ya está en el sistema.

## Criterios de aceptación

- [x] El bot responde solo con datos del usuario autenticado (nunca de otros).
- [x] Reconoce y responde al menos: notas por materia, promedio general, próximas tareas, estado de asistencia y próximas reuniones/eventos.
- [x] Una pregunta fuera de su conocimiento responde con un mensaje amable y una sugerencia (ej. contactar al admin), sin romper la conversación.
- [x] El historial de la conversación vive solo en el cliente (no se persiste en BD).
- [x] La API ofrece un endpoint de chat protegido que recibe la pregunta y devuelve la respuesta.
- [x] Funciona sin conexión a internet ni claves de APIs de IA: cero dependencias externas.

## Fuera de alcance

- Modelo de lenguaje externo ni generación de texto libre.
- Entrenamiento con el corpus documental de la institución.
- Voz, adjuntos ni respuestas sobre datos no académicos.