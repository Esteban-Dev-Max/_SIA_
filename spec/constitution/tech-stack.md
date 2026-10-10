# Tech stack y convenciones

Cómo está construido SIA y las reglas que todo el código debe respetar. Es la referencia técnica que ningún plan de feature debería contradecir.

## Tecnologías

- **Lenguaje:** JavaScript (backend, ESM) y TypeScript 5 estricto (frontend).
- **Framework / runtime:** Node 20+ — Express 4 (backend) + React 19 con Vite 8 y TanStack Start/Router/Query (frontend).
- **Base de datos:** MySQL 8 (XAMPP), acceso con `mysql2/promise` y sentencias preparadas; BD `academico` con soporte **multi-tenant** (`institucion_id` en las tablas de datos).
- **Tests:** backend con `node --test` + Supertest (BD `academico_test`), frontend con Vitest + Testing Library y E2E con Playwright (`e2e/`). Scripts: `test`, `test:unit`, `test:setup:db`, `test:integration`, `test:e2e` en la raíz.
- **Despliegue:** backend en `:3001`, UI en `:8080`; accesible desde otros dispositivos de la misma red WiFi. Además hay un despliegue público **multi-tenant** vía **Tailscale Funnel** (`https://sia.<tailnet>.ts.net`) donde un rol **superadmin** gestiona las instituciones.

## Archivos / módulos clave

- `backend/app.js` — app Express (factory): CORS (red local + `CORS_ORIGIN` + orígenes dinámicos por `Host` para túneles), `/health` y `/api/health`, estáticos de `uploads/`, montado de routers bajo `/api/*` y manejo global de errores (400/413/duplicados/claves foráneas). `backend/index.js` — entrada: arranca el listener y chequea MySQL.
- `backend/db.js` — pool MySQL (`decimalNumbers: true`).
- `backend/migrate.js` + `backend/migrations/001_init.sql`, `002_multi_tenant.sql`, `003_institucion_logo.sql`, `004_password_reset.sql`, `005_tareas_columna_nota.sql`, `006_trazabilidad_asistencia.sql`, `007_quitar_creditos.sql` — esquema base, multi-tenant/superadmin, logo de institución, tokens de recuperación de contraseña, vínculo de tareas con la planilla de notas, trazabilidad de asistencia y retiro de créditos (borra y recrea las tablas a propósito).
- `backend/seed.js` — datos demo idempotentes (institución, usuarios incl. superadmin, materias, grupos, notas, asistencia, tareas, eventos, mensajes, notificaciones).
- `backend/routes/` — `auth.js` (incluye `login`, `me`, `cambiar-password` y el flujo de recuperación `forgot-password`/`reset-password`), `admin.js`, `profesor.js`, `acudiente.js`, `notas.js`, `asistencia.js`, `tareas.js`, `calendario.js`, `chatbot.js`, `chat.js`, `mensajes.js`, `notificaciones.js`, `instituciones.js` (solo superadmin), `usuarios.js` (admin/superadmin, incluida la carga masiva).
- `backend/middleware/` — `auth.js` (verifyToken + requireRole), `asyncHandler`.
- `backend/lib/` — `notas.js` (ponderación única), `notasTareas.js` (reescalado/promedio y sincronización de tareas → planilla), `horario.js` (choque de horarios), `rateLimit.js` (límites del chatbot, forgot-password y bloqueo por fuerza bruta en login), `lan.js` (CORS de red local), `notificar.js`, `mailer.js` (envío SMTP con respaldo dev), `chatbotEngine.js`.
- `backend/uploads/` — `avatars/`, `logos/`, `excusas/` (archivos subidos con multer).
- `backend/tests/` — `unit/` y `integration/` (Supertest, BD `academico_test`).
- `frontend/src/routes/` — rutas por archivo en kebab-case; paneles por rol en `routes/<rol>/` con `route.tsx`. Extra: `admin/usuarios.tsx`, `admin/instituciones.tsx`, `admin/academico.tsx`, `configuracion.tsx` (perfil/foto, tema, contraseña). Públicas: `login.tsx`, `forgot-password.tsx`, `reset-password.tsx`.
- `frontend/src/lib/` — `api.ts` (fetch + JWT, resuelve la API por protocolo/host, `urlRecurso()` para avatares/logos, `apiFetch()`/`apiBlob()`/`vistaArchivo()`), `guard.ts` (RBAC), `theme.ts`, `error-capture.ts`, `error-page.ts`, `utils.ts`.
- `frontend/src/components/` — `AuthGate`, `PanelShell`, `DataTable`, `StatCard`, `ChatbotWidget`, `NotificationBell`, `AsistenciaTab`, `HistorialAsistenciaTab`, `InstitucionModal`, `ThemeProvider`, `ThemeToggle` y `ui/` (shadcn/ui sobre Radix).
- `e2e/` — tests Playwright (`auth.spec.ts`, `superadmin.spec.ts`).

## Comandos

- `backend/`: `npm run dev` — API en `http://localhost:3001` (`node --watch`).
- `backend/`: `npm run migrate` — crea/borra y recrea todas las tablas aplicando 001-007 (destructivo).
- `backend/`: `npm run seed` — inserta datos demo (idempotente).
- `frontend/`: `npm run dev` — UI en `http://localhost:8080`.
- `frontend/`: `npm run lint` — ESLint + Prettier, 0 errores esperados.
- `frontend/`: `npm run build` — compila para producción (TanStack Start + Nitro).
- Tests (raíz): `npm test`, `npm run test:unit`, `npm run test:setup:db`, `npm run test:integration`, `npm run test:e2e`.

## Modelo de datos / dominio

- `usuarios.rol` — ENUM `superadmin|admin|profesor|estudiante|acudiente`; `password` siempre hash bcrypt (10 rondas); `estado` activo/inactivo; `institucion_id` NULL solo para `superadmin`; `foto_url` para el avatar.
- `instituciones` — datos de la institución + `estado` (activo/inactivo, invalidan sesiones) y `logo_url` (branding multi-tenant).
- `notas` — 1 fila por matrícula (UNIQUE). Ponderación: `nota_1` 25% + `nota_2` 25% + `nota_3` 20% + `examen_final` 30%. La fórmula está **duplicada** en `lib/notas.js` (fuente del backend) y `frontend/src/routes/profesor/index.tsx`; mantener ambas sincronizadas. Se aprueba con 3.0.
- `asistencia` — `estado` ENUM `presente|ausente|tarde|excusa`; único por (matrícula, fecha); con observación y **soporte de excusa** (`archivo_ruta`, `archivo_mime`, `archivo_nombre`).
- `grupos` — materia + profesor + periodo + horario. `matriculas` vincula estudiante↔grupo con clave única (estudiante, grupo).
- `tareas` / `entregas_tareas` — tarea por grupo (puntaje máx. por defecto 10); `tareas.columna_nota` ENUM `nota_1|nota_2|nota_3|examen_final` (NULL = sin vincular) indica el casillero de la planilla al que se sincroniza la tarea; entrega única por (tarea, estudiante) con `archivo_url` (texto, sin subida real), calificación y retroalimentación. Al calificar una entrega, `lib/notasTareas.js` reescala la nota a `0.0–5.0` (`calificación / puntaje_max × 5`) y promedia las tareas del mismo casillero por estudiante en `notas`, notificando al estudiante cuando cambia.
- `eventos_calendario` — `tipo` ENUM `institucional|evaluacion|entrega|reunion`; `curso_id` opcional (FK a carreras_grados, SET NULL).
- `mensajes` — remitente/destinatario, contenido, `leido` TINYINT.
- `notificaciones` — `tipo` ENUM `sistema|nota|tarea|mensaje|evento`, `leida` TINYINT.
- `acudiente_estudiante` — N:M entre acudientes y estudiantes (único por par).
- `password_resets` — tokens de recuperación: `token_hash` (sha256 del token, nunca el token plano), `expira_en` (+1 h), `usado` TINYINT y FK a `usuarios` con ON DELETE CASCADE.
- `carreras_grados` / `materias` — carrera con código único; materia con carrera opcional (FK SET NULL).
- **Multi-tenant:** `institucion_id` en `usuarios`, `carreras_grados`, `materias`, `grupos`, `matriculas`, `eventos_calendario`, `mensajes`, `tareas` y `notificaciones`; todo query de datos filtra por `req.user.institucion_id`.

## Convenciones

- Backend **ESM**: extensiones `.js` explícitas en los imports relativos (p. ej. `import { pool } from "../db.js"`).
- Todo acceso a BD usa el `pool` de `mysql2/promise` de `../db.js`, siempre con sentencias preparadas y placeholders `?`.
- Envuelve cada handler async de ruta con `asyncHandler`; un handler async crudo puede tumbar el proceso.
- Cada router llama `router.use(verifyToken)` (`middleware/auth.js`) y controla el rol con `requireRole(...)`. `req.user.id` = id del usuario autenticado; `req.user` incluye `rol`, `institucion_id`, `institucion_logo`, `institucion_estado`, `institucion_nombre`.
- Recuperación de contraseña (endpoints públicos): `POST /api/auth/forgot-password` responde siempre el mensaje genérico (no revela si un correo existe) y `POST /api/auth/reset-password` valida el token (1 hora, `password_resets`) y re-hashea con bcrypt. Envío con `lib/mailer.js` usando `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`; sin SMTP el enlace se imprime en consola (dev). `FRONTEND_URL` construye el enlace del correo.
- Sincronización Tareas → Notas: `tareas.columna_nota` (ENUM, NULL = sin vincular) apunta al casillero de la planilla. Al calificar una entrega (`POST /api/tareas/calificar/:entrega_id`), `lib/notasTareas.js` reescala la nota a `0.0–5.0`, promedia las entregas del mismo casillero por estudiante y escribe `notas` recalculando la definitiva (notifica al estudiante si cambia). En `POST /api/notas/guardar` y en la planilla del profesor, los casilleros gestionados por tareas se ignoran/deshabilitan (solo lectura); si se borran todas las calificaciones, el casillero vuelve a `null`.
- Errores JSON `{ error: "<mensaje en español>" }`. Estados: 400 entrada inválida, 401 token ausente/inválido, 403 prohibido, 500 interno.
- Emite notificaciones vía `notificar(usuario_id, titulo, mensaje, tipo)` de `../lib/notificar.js`.
- Frontend: alias `@` → `src`; usa `api()` de `@/lib/api` para todos los fetch y `urlRecurso()` para avatares/logos. Token/usuario en `localStorage` (`token`, `user`) o `sessionStorage`; `getToken()` lee localStorage primero. Clave de tema: `sia-theme`.
- Prettier vía ESLint: printWidth 100, comillas dobles, punto y coma.
- Páginas protegidas con layout `route.tsx` por rol: `requireRole("...")` en `beforeLoad` + `<AuthGate>` + `<PanelShell>`.
- Toda la UI y los mensajes de error en **español**.

## Estilo visual

- **Tema:** claro/oscuro mediante clase `.dark` (alternador persistido en `sia-theme`), con tokens CSS en formato oklch definidos en `frontend/src/styles.css`.
- **Tipografías:** Inter (sans), Plus Jakarta Sans (display/títulos), JetBrains Mono (mono).
- **Componentes:** shadcn/ui sobre Radix UI (`src/components/ui/`); radio base `--radius: 0.75rem`.
- **Efectos propios:** fondos mesh (`mesh-bg`, `mesh-bg-intense`), tarjetas glass (`glass-card`), texto con gradiente (`gradient-text`), bordes con gradiente (`gradient-border`) y animaciones fade-in/slide-up/scale-in.
- **Layout/responsive:** sidebar colapsable en escritorio; el panel se adapta al móvil porque el sistema está diseñado para usarse desde el celular en la red local.

## Límites duros

- No editar a mano `routeTree.gen.ts` ni los contenidos de `.tanstack/` (generados por el dev server/plugin).
- No usar `localhost` en llamadas a la API del frontend (rompe el uso en red local); confiar en la resolución automática de `@/lib/api`.
- No importar `server-only` (ESLint lo prohíbe con `no-restricted-imports`); el código solo-server va en `*.server.ts`.
- No subir archivos `.env*` al repositorio. Ojo: `frontend/.env` está versionado a propósito (VITE_API_URL para SSR) y `backend/.env.example` llegó a contener una key real de Gemini — mantenlos sin secretos.
- No consultar tablas de datos sin filtrar por `institucion_id`: rompe el aislamiento multi-tenant.
- No cambiar la ponderación de la nota (25/25/20/30) en un solo lugar: vive en `lib/notas.js` y en la fórmula del frontend (`profesor/index.tsx`).
- No modificar `migrate.js` para que deje de ser destructivo: `npm run migrate` borra y recrea las tablas a propósito.
- No dejar `JWT_SECRET` con el valor del placeholder de `.env.example`: `app.js` solo aborta si la variable falta, no si es la predeterminada.
- No añadir dependencias ni frameworks nuevos sin avisar.