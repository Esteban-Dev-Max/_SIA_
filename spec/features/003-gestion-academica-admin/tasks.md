# 003 · Gestión académica (admin) — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] CRUD de usuarios en `backend/routes/admin.js` y `frontend/src/routes/admin/usuarios.tsx` (bcrypt al crear, activar/inactivar, filtro por rol).
- [x] CRUD de grados (nombre, nivel, orden) y asignaturas (código opcional, grado opcional).
- [x] Creación de cursos (grado + letra + director + año, únicos) y asignaciones (curso + asignatura + docente + periodo `AAAA-PN` + horario, con control de choques).
- [x] Matrícula anual con clave única (estudiante, curso), herencia de asignaturas y bloqueo ante notas/asistencia; retiro con confirmación.
- [x] Vinculación acudiente-estudiante con par único.
- [x] CRUD de eventos del calendario y estadísticas generales en `admin/index.tsx`.
- [x] Layout protegido `admin/route.tsx` (`requireRole("admin")` + `AuthGate` + `PanelShell`) y pantalla `admin/academico.tsx`.
- [x] Permitir al admin registrar notas reutilizando el flujo del profesor.
- [x] Validar: CRUD completo con los usuarios demo, respuestas 400 en español y redirección de rol.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.