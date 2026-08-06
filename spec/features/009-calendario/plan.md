# 009 · Calendario — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Un calendario unificado alimentado por dos fuentes: `eventos_calendario` (eventos institucionales que crea el admin) y `tareas` (con `fecha_entrega`) de los grupos del usuario. La API une ambas fuentes según el rol y el frontend las pinta en vistas mensual y semanal con `react-day-picker`/`date-fns`. El chatbot (feature 010) reutiliza la misma consulta para responder sobre reuniones.

## Implementación

1. **API** — `backend/routes/calendario.js`: consulta los eventos (según `curso_id` y tipo) y las tareas con vencimiento de los grupos del usuario (profesor: sus grupos; estudiante: sus matrículas; admin: todos). Devuelve un arreglo unificado con tipo de origen (`evento`|`tarea`).
2. **CRUD de eventos** — creación/edición/borrado en `routes/admin.js` (título, descripción, fecha inicio/fin, tipo `institucional|evaluacion|entrega|reunion`, curso opcional).
3. **UI** — `frontend/src/routes/calendario.tsx`: alternador mensual/semanal, eventos con color según tipo y tareas con su fecha límite; el detalle muestra descripción y hora.
4. **Notificación** — al crear un evento se emite una notificación tipo `evento` a los afectados.

## Decisiones

- **Una sola vista unificada** — tareas y eventos conviven en el mismo grid (se descartó pestañas separadas: el objetivo es una sola mirada al mes).
- **Rol define el alcance** — el estudiante solo ve sus tareas; el profesor las de sus grupos; el admin, todas más el CRUD de eventos.
- **La fecha límite de la tarea es la fuente única** — el calendario lee `tareas.fecha_entrega`, igual que el listado de tareas (sin duplicar fechas).

## Riesgos

- **Eventos huérfanos por curso borrado** — `curso_id` usa ON DELETE SET NULL: el evento sobrevive sin asociación (se muestra como institucional).
- **Rendimiento del rango** — se filtra por `fecha_inicio`/`fecha_entrega` en el rango consultado para no traer todo el historial.