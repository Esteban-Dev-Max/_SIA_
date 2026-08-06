# 004 · Notas — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] Implementar actualización de notas en `backend/routes/notas.js` (rango 0-5, validación de profesor del grupo, recálculo 25/25/20/30).
- [x] Mantener la misma ponderación en `backend/seed.js` (regla de sincronización de la constitución).
- [x] Exponer la planilla por grupo a profesor y admin (rutas y UI de `profesor/index.tsx` y `admin/index.tsx`).
- [x] Consulta de notas y promedio general para el estudiante (`routes/estudiante.js` + `estudiante/index.tsx`).
- [x] Promedio ponderado por materia para el acudiente (`routes/acudiente.js`).
- [x] Enviar notificación tipo `nota` al estudiante al publicar calificaciones (`notificar()`).
- [x] Validar: registro de notas con los datos demo, error 400 fuera de rango y paridad visual de definitiva en ambos paneles.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.