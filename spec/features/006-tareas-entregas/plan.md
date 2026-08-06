# 006 · Tareas y entregas — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Dos tablas relacionadas: `tareas` (por grupo) y `entregas_tareas` (por tarea y estudiante, con calificación y retroalimentación). El router `backend/routes/tareas.js` cubre creación/consulta para profesor y consulta/entrega para estudiante; el frontend separa las vistas por rol (`profesor/tareas.tsx` y `estudiante/tareas.tsx`).

## Implementación

1. **API profesor** — `routes/tareas.js` (con `requireRole("profesor", "admin")`): crear tarea por grupo, listar tareas del grupo con las entregas y estado por estudiante, calificar entrega (nota + retroalimentación).
2. **API estudiante** — listar tareas de sus grupos (con fecha de vencimiento y si ya entregó), crear/actualizar su entrega (`INSERT ... ON DUPLICATE KEY UPDATE` por par tarea+estudiante).
3. **UI profesor** — `frontend/src/routes/profesor/tareas.tsx`: selección de grupo, lista de tareas, detalle con entregas y formulario de calificación.
4. **UI estudiante** — `frontend/src/routes/estudiante/tareas.tsx`: listado con vencimientos y estado, formulario de entrega (enlace + comentario) y visualización de la nota y retroalimentación.
5. **Notificaciones** — al calificar se llama a `notificar(estudiante_id, ..., tipo: "tarea")`; las tareas próximas se comparten con el calendario (feature 009) vía las mismas rutas de lectura.

## Decisiones

- **Entrega única por (tarea, estudiante)** — la clave única de `entregas_tareas` evita duplicados; reentregar es un upsert.
- **`archivo_url` como texto** — sin almacenamiento de archivos en esta fase (en backlog); el estudiante pega un enlace a su archivo (Drive, etc.).
- **Calificación independiente de la ponderación de notas** — la nota de la tarea es un campo propio de la entrega, no alimenta `notas.nota_*` (se descartó mezclarlas: la planilla queda intacta).

## Riesgos

- **Entrega sobre tarea inexistente o ajena al grupo del estudiante** — la API valida matrícula y grupo antes de aceptar.
- **Estados desincronizados con el calendario** — la fecha límite se lee de `tareas.fecha_entrega` en ambas vistas (misma fuente).