# 003 · Gestión académica (admin) — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Módulo administrador como CRUD tradicional sobre tablas del esquema, en `backend/routes/admin.js`, con el panel frontal en `frontend/src/routes/admin/` usando componentes reutilizables (`DataTable`, `StatCard`, diálogos de `components/ui/`). Cada recurso tiene su ruta REST (`/api/admin/<recurso>`) protegida con `verifyToken` + `requireRole("admin")`, y los cambios relevantes emiten notificaciones vía `notificar()`.

## Implementación

1. **Usuarios** — CRUD en `routes/admin.js`: crear (hash bcrypt de la contraseña), listar con filtro por rol, editar y activar/inactivar (`usuarios.estado`). Frontend en `frontend/src/routes/admin/usuarios.tsx`.
2. **Carreras y materias** — CRUD de `carreras_grados` (nombre, código único) y `materias` (nombre, código único, créditos, carrera opcional).
3. **Grupos** — creación de `grupos` por materia, profesor y periodo, con horario; verificación de que profesor y materia existen.
4. **Matrículas** — inscribir estudiante en grupo (`matriculas` con `fecha_matricula`) y eliminar matrículas; clave única (estudiante, grupo).
5. **Acudientes** — vinculación N:M en `acudiente_estudiante` (par único).
6. **Estadísticas y eventos** — `routes/admin.js` agrega métricas generales (usuarios, grupos, matrículas, promedios) y CRUD de `eventos_calendario`; frontend en `frontend/src/routes/admin/index.tsx`.
7. **Panel** — `frontend/src/routes/admin/route.tsx` protege el rol y envuelve en `AuthGate` + `PanelShell`; `admin/academico.tsx` agrupa la gestión académica.

## Decisiones

- **Un solo router de admin** — todos los recursos del rol viven en `routes/admin.js` (se descartó un router por recurso: el volumen no lo justifica).
- **Borrado por cascada con FK** — eliminar una carrera quita sus materias solo si no están en uso (SET NULL); borrar grupo borra matrículas y notas (CASCADE). Comportamiento explícito en `001_init.sql`.
- **Admin también registra notas** — reutiliza el flujo del profesor (misma lógica de `routes/notas.js`) para cubrir ausencias del docente.
- **UI con componentes reutilizables** — `DataTable` y `StatCard` evitan repetir tablas y tarjetas en cada pantalla.

## Riesgos

- **CRUD que rompe referencias** — al borrar usuarios en uso (profesores con grupos, estudiantes con matrículas) la cascada elimina datos académicos; se mitiga pidiendo confirmación y usando activar/inactivar en lugar de borrar cuando aplica.
- **Correo duplicado** — `usuarios.correo` es UNIQUE; la API valida y responde 400 en español.