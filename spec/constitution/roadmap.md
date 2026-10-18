# Roadmap

Orden y estado de las features de SIA. Cada entrada apunta a su carpeta en `features/`.

## Hecho ✅

1. **001 · Infraestructura** — backend Express + frontend TanStack arrancan con `migrate`/`seed` y quedan operativos en red local.
2. **002 · Autenticación y RBAC** — login con JWT (8 h), sesión persistente u opcional y control de acceso por rol en API y UI.
3. **003 · Gestión académica (admin)** — CRUD de usuarios, grados, asignaturas, cursos, asignaciones, matrículas anuales y acudientes, más panel de estadísticas.
4. **004 · Notas** — registro con ponderación 25/25/20/30, definitiva automática y consulta en tiempo real por el estudiante.
5. **005 · Asistencia** — toma diaria por clase (presente/ausente/tarde/excusa) e historial con porcentajes.
6. **006 · Tareas y entregas** — tareas por clase, entregas de estudiantes y calificación con retroalimentación.
7. **007 · Mensajería interna** — chat entre los cuatro roles con indicadores de leídos.
8. **008 · Notificaciones** — campana con cinco tipos de alerta y polling cada 60 s.
9. **009 · Calendario** — eventos institucionales y tareas con fecha límite en vista mensual y semanal unificada.
10. **010 · Chatbot SIA** — asistente que responde preguntas académicas con datos reales del usuario.
11. **011 · Portal acudiente** — monitoreo del rendimiento, alertas de inasistencia y boletín imprimible.
12. **012 · Identidad, tema y configuración** — branding SIA, tema claro/oscuro y pantalla de configuración.
13. **013 · Multi-tenant y superadmin (SaaS)** — rol `superadmin`, CRUD de instituciones con logo y estado (activo/inactivo), alta con admin inicial y aislamiento de datos por `institucion_id`.
14. **014 · Carga masiva de usuarios** — alta de docentes/estudiantes/acudientes desde CSV/XLSX con validación por fila y reporte de errores.
18. **018 · Modelo colegio** — migración del modelo de instituto (carreras/materias/grupos/fichas, periodo semestral) al de colegio: grados con nivel, asignaturas, cursos con director de grupo y año lectivo, asignaciones por periodo `AAAA-PN` y matrícula anual con herencia de asignaturas.
15. **015 · Perfil, avatares y archivos** — foto de perfil de usuarios (JPG/PNG/WEBP), subida de logos de institución y soportes (PDF/JPG/PNG) de excusas de asistencia.
16. **016 · Recuperación de contraseña** — flujo por correo (SMTP) para todos los roles: `forgot-password` con respuesta genérica y `reset-password` con token de 1 hora (tabla `password_resets`).
17. **017 · Sincronización de tareas con notas** — las tareas pueden asignarse a un casillero de la planilla (`tareas.columna_nota`); al calificar las entregas, la nota se reescala de `0..puntaje_max` a `0.0–5.0` y se promedia automáticamente en el casillero (por estudiante), con notificación al estudiante. En la planilla, los casilleros gestionados por tareas salen de solo lectura con distintivo "Promedio tareas".

## Siguiente 🔜

_No hay features en curso._

## Backlog / ideas 💡

- **Boletín PDF por servidor** — reemplazar la impresión del navegador por un PDF generado desde el backend.
- **Archivos adjuntos reales en tareas** — subida física de los archivos de entrega (hoy `archivo_url` es solo texto; el patrón de multer ya se usa en avatares/logos/excusas).
- **Reportes comparativos por periodo** — comparar rendimiento entre periodos académicos.

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `spec.md`, `plan.md` y `tasks.md` antes de tocar código.