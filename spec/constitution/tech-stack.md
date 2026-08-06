# Tech stack y convenciones

Cómo está construido SIA y las reglas que todo el código debe respetar. Es la referencia técnica que ningún plan de feature debería contradecir.

## Tecnologías

- **Lenguaje:** JavaScript (backend, ESM) y TypeScript 5 estricto (frontend).
- **Framework / runtime:** Node 20+ — Express 4 (backend) + React 19 con Vite 8 y TanStack Start/Router/Query (frontend).
- **Base de datos:** MySQL 8 (XAMPP), acceso con `mysql2/promise` y sentencias preparadas; BD `academico` con 14 tablas.
- **Tests:** no existe suite de pruebas. La validación es `npm run lint` + `npm run build` (frontend) y el flujo real `npm run migrate` + `npm run seed` + prueba manual por rol (backend).
- **Despliegue:** entorno local de red — API en `:3001`, UI en `:8080`; accesible desde otros dispositivos de la misma red WiFi. Sin despliegue a producción pública.

## Archivos / módulos clave

- `backend/index.js` — app Express: CORS, montado de routers bajo `/api/*` y manejo global de errores.
- `backend/db.js` — pool MySQL (`decimalNumbers: true`).
- `backend/migrate.js` + `backend/migrations/001_init.sql` — esquema completo de la BD (borra y recrea las tablas a propósito).
- `backend/seed.js` — datos demo idempotentes (institución, usuarios, materias, grupos, notas, asistencia, tareas, eventos, mensajes, notificaciones).
- `backend/routes/` — `auth.js`, `admin.js`, `profesor.js`, `estudiante.js`, `acudiente.js`, `notas.js`, `asistencia.js`, `tareas.js`, `calendario.js`, `chatbot.js`, `mensajes.js`, `notificaciones.js`.
- `backend/middleware/` — `auth.js` (verifyToken), `requireRole`, `asyncHandler`.
- `backend/lib/` — `lan.js` (CORS de red local), `notificar.js` (crea notificaciones).
- `frontend/src/routes/` — rutas por archivo en kebab-case; paneles por rol en `routes/<rol>/` con `route.tsx`.
- `frontend/src/lib/` — `api.ts` (fetch + JWT, resuelve la API a `window.location.hostname:3001`), `guard.ts` (RBAC), `theme.ts`, `utils.ts`.
- `frontend/src/components/` — `AuthGate`, `PanelShell`, `DataTable`, `StatCard`, `ChatbotWidget`, `NotificationBell`, `ThemeProvider`, `ThemeToggle` y `ui/` (shadcn/ui sobre Radix).

## Comandos

- `backend/`: `npm run dev` — API en `http://localhost:3001` (`node --watch`).
- `backend/`: `npm run migrate` — crea/borra y recrea todas las tablas (destructivo).
- `backend/`: `npm run seed` — inserta datos demo (idempotente).
- `frontend/`: `npm run dev` — UI en `http://localhost:8080`.
- `frontend/`: `npm run lint` — ESLint + Prettier, 0 errores esperados.
- `frontend/`: `npm run build` — compila para producción (TanStack Start + Nitro).

## Modelo de datos / dominio

- `usuarios.rol` — ENUM `admin|profesor|estudiante|acudiente`; `password` siempre hash bcrypt (10 rondas); `estado` activo/inactivo; correo único.
- `notas` — 1 fila por matrícula (UNIQUE). Ponderación: `nota_1` 25% + `nota_2` 25% + `nota_3` 20% + `examen_final` 30%. La fórmula está **duplicada** en `routes/notas.js` y `seed.js`; mantener ambas sincronizadas. Se aprueba con 3.0.
- `asistencia` — `estado` ENUM `presente|ausente|tarde|excusa`; único por (matrícula, fecha); con observación.
- `grupos` — materia + profesor + periodo + horario. `matriculas` vincula estudiante↔grupo con clave única (estudiante, grupo).
- `tareas` / `entregas_tareas` — tarea por grupo (puntaje máx. por defecto 10); entrega única por (tarea, estudiante) con `archivo_url` (texto, sin subida real), calificación y retroalimentación.
- `eventos_calendario` — `tipo` ENUM `institucional|evaluacion|entrega|reunion`; `curso_id` opcional (FK a carreras_grados, SET NULL).
- `mensajes` — remitente/destinatario, contenido, `leido` TINYINT.
- `notificaciones` — `tipo` ENUM `sistema|nota|tarea|mensaje|evento`, `leida` TINYINT.
- `acudiente_estudiante` — N:M entre acudientes y estudiantes (único por par).
- `carreras_grados` / `materias` — carrera con código único; materia con créditos y carrera opcional (FK SET NULL).
- `instituciones` — datos generales de la institución (nombre, correo, teléfono, departamento, ciudad).

## Convenciones

- Backend **ESM**: extensiones `.js` explícitas en los imports relativos (p. ej. `import { pool } from "../db.js"`).
- Todo acceso a BD usa el `pool` de `mysql2/promise` de `../db.js`, siempre con sentencias preparadas y placeholders `?`.
- Envuelve cada handler async de ruta con `asyncHandler`; un handler async crudo puede tumbar el proceso.
- Cada router llama `router.use(verifyToken)` (`middleware/auth.js`) y controla el rol con `requireRole(...)`. `req.user.id` = id del usuario autenticado.
- Errores JSON `{ error: "<mensaje en español>" }`. Estados: 400 entrada inválida, 401 token ausente/inválido, 403 prohibido, 500 interno.
- Emite notificaciones vía `notificar(usuario_id, titulo, mensaje, tipo)` de `../lib/notificar.js`.
- Frontend: alias `@` → `src`; usa `api()` de `@/lib/api` para todos los fetch. Token/usuario en `localStorage` (`token`, `user`) o `sessionStorage`; `getToken()` lee localStorage primero. Clave de tema: `sia-theme`.
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
- No subir archivos `.env*` al repositorio.
- No cambiar la ponderación de la nota (25/25/20/30) en un solo lugar.
- No modificar `migrate.js` para que deje de ser destructivo: `npm run migrate` borra y recrea las tablas a propósito.
- No añadir dependencias ni frameworks nuevos sin avisar.