# 003 · Gestión académica (admin) — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Módulo administrador como CRUD tradicional sobre tablas del esquema, en `backend/routes/admin.js`, con el panel frontal en `frontend/src/routes/admin/` usando componentes reutilizables (`DataTable`, `StatCard`, diálogos de `components/ui/`). Cada recurso tiene su ruta REST (`/api/admin/<recurso>`) protegida con `verifyToken` + `requireRole("admin")`, y los cambios relevantes emiten notificaciones vía `notificar()`.

## Implementación

1. **Usuarios** — CRUD en `routes/admin.js`: crear (hash bcrypt de la contraseña), listar con filtro por rol, editar y activar/inactivar (`usuarios.estado`). Frontend en `frontend/src/routes/admin/usuarios.tsx`.
2. **Grados y asignaturas** — CRUD de `grados` (nombre, nivel, orden) y `asignaturas` (nombre, código corto opcional, grado opcional).
3. **Cursos** — creación de `cursos` por grado, letra, director de grupo y año lectivo; clave única (grado, letra, año).
4. **Asignaciones** — qué docente dicta cada asignatura del curso por periodo `AAAA-PN` y horario; verificación de curso, asignatura y docente más control de choques de horario.
5. **Matrículas** — matrícula anual (`matriculas_curso` con clave única estudiante+curso) que hereda las asignaciones del curso como `matriculas`; cambio/retiro bloqueado si hay notas o asistencia.
6. **Acudientes** — vinculación N:M en `acudiente_estudiante` (par único).
7. **Estadísticas y eventos** — `routes/admin.js` agrega métricas generales (usuarios, cursos, matrículas, promedios) y CRUD de `eventos_calendario`; frontend en `frontend/src/routes/admin/index.tsx`.
7. **Panel** — `frontend/src/routes/admin/route.tsx` protege el rol y envuelve en `AuthGate` + `PanelShell`; `admin/academico.tsx` agrupa la gestión académica.

## Decisiones

- **Un solo router de admin** — todos los recursos del rol viven en `routes/admin.js` (se descartó un router por recurso: el volumen no lo justifica).
- **Borrado por cascada con FK** — eliminar un grado desvincula sus asignaturas (SET NULL); borrar curso o asignación borra matrículas y notas (CASCADE). Comportamiento explícito en `001_init.sql`.
- **Admin también registra notas** — reutiliza el flujo del docente (misma lógica de `routes/notas.js`) para cubrir ausencias del docente.
- **UI con componentes reutilizables** — `DataTable` y `StatCard` evitan repetir tablas y tarjetas en cada pantalla.

## Riesgos

- **CRUD que rompe referencias** — al borrar usuarios en uso (docentes con asignaciones, estudiantes con matrículas) la cascada elimina datos académicos; se mitiga pidiendo confirmación y usando activar/inactivar en lugar de borrar cuando aplica.
- **Correo duplicado** — `usuarios.correo` es UNIQUE; la API valida y responde 400 en español.