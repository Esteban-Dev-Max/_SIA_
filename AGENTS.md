# SIA — Sistema Integral Académico

Aplicación web full-stack para instituciones educativas: centraliza la gestión de estudiantes, profesores, carreras, materias, notas, asistencia, tareas y comunicaciones, con paneles dedicados por rol y un chatbot. Los mensajes de la UI y los errores de la API están en **español**.

## Stack
- Lenguaje: JavaScript (backend) y TypeScript 5 estricto (frontend)
- Framework / runtime: Node 20+ — Express 4 (backend, ESM) + React 19 con Vite 8 y TanStack Start/Router/Query (frontend)
- Base de datos: MySQL 8 (XAMPP), accede con `mysql2/promise` y sentencias preparadas
- Tests: no existe suite de pruebas

## Comandos
- **Backend** (desde `backend/`): `npm run dev` — arranca la API en `http://localhost:3001` (`node --watch`). `npm run migrate` — crea/borra y recrea todas las tablas (destructivo). `npm run seed` — inserta datos demo (idempotente).
- **Frontend** (desde `frontend/`): `npm run dev` — arranca la UI en `http://localhost:8080`.
- `npm run lint` — revisa el estilo (ESLint + Prettier), 0 errores esperados. Se corre en `frontend/`.
- `npm run build` — compila para producción (TanStack Start + Nitro). Verificación de QA junto con `lint`.
- **No hay script de typecheck**; `vite build` es la verificación más cercana del frontend.

## Estructura del proyecto
- `backend/` — API REST Express. `index.js` (entrada, monta routers bajo `/api/*`), `db.js` (pool MySQL), `routes/` (auth, admin, profesor, estudiante, acudiente, notas, asistencia, tareas, calendario, chatbot, mensajes, notificaciones), `middleware/` (verifyToken, requireRole, asyncHandler), `lib/` (lan.js, notificar.js), `migrations/001_init.sql`, `seed.js`.
- `frontend/` — React 19 + TanStack (SSR). Rutas por archivo en `src/routes/` (kebab-case), paneles por rol en `src/routes/<rol>/`, capa de datos/API en `src/lib/`, componentes en `src/components/` (incluye shadcn/ui en `ui/`).
- Ejecuta backend y frontend desde **sus propios directorios** (dos terminales); son paquetes npm independientes con `node_modules` separados.

## Convenciones
- Backend **ESM**: usa extensiones `.js` explícitas en los imports relativos (p. ej. `import { pool } from "../db.js"`).
- Todo acceso a BD usa el `pool` de `mysql2/promise` de `../db.js`, siempre con **sentencias preparadas** y placeholders `?`.
- Envuelve cada handler async de ruta con `asyncHandler` de `../middleware/asyncHandler.js`; un handler async crudo puede tumbar el proceso.
- Auth: cada router llama `r.use(verifyToken)` (`middleware/auth.js`) y controla el rol con `requireRole(...)`. `req.user.id` = id del usuario autenticado.
- Los errores son JSON `{ error: "<mensaje en español>" }`. Estados: 400 entrada inválida, 401 token ausente/inválido, 403 prohibido, 500 interno.
- Emite notificaciones vía `notificar(usuario_id, titulo, mensaje, tipo)` de `../lib/notificar.js` (`tipo`: sistema|nota|tarea|mensaje|evento).
- Frontend: alias de import `@` → `src`. Usa `api()` de `@/lib/api` para todos los fetch; resuelve la API a `window.location.hostname:3001`.
- Las contraseñas siempre se almacenan con hash bcrypt (10 rondas). Token/usuario en `localStorage` (`token`, `user`) o `sessionStorage`; `getToken()` lee localStorage primero. Clave de tema: `sia-theme`.
- Prettier se aplica vía ESLint: printWidth **100**, comillas dobles, `;`.
- Crea páginas protegidas con un layout `route.tsx` por rol: `route.tsx` con `requireRole("...")` en `beforeLoad` y envuelto en `<AuthGate>` + `<PanelShell>`.

## No hagas
- No edites a mano `routeTree.gen.ts` ni los contenidos de `.tanstack/` (generados por el dev server/plugin). Reinicia `npm run dev` para regenerarlos.
- No uses `localhost` en llamadas a la API (rompe el uso en red local); confía en la resolución automática de `@/lib/api`.
- No importes `server-only` (ESLint lo prohíbe con `no-restricted-imports`). Para código solo-server usa `*.server.ts`.
- No subas archivos `.env*` al repositorio. No cambies la ponderación de la nota (25% / 25% / 20% / 30%) en solo un lugar: está duplicada en `routes/notas.js` y `seed.js` — manten ambas sincronizadas.
- No cambies `migrate.js` para que deje de ser destructivo; `npm run migrate` borra y recrea todas las tablas a propósito.

## Flujo de trabajo
- Antes de una tarea no trivial, propón un plan y espera mi OK.
- Una tarea a la vez; al terminar, dime qué cambiaste para que lo revise.
- Si no estás seguro al 80%, pregunta. No inventes.

## Documentación
- `README.md` (raíz) — descripción general, instalación, cuentas demo y orden de arranque (MySQL/XAMPP → migrate → seed → dev).
- `backend/README.md` — guía de red local/firewall.
- `migrations/001_init.sql` — esquema relacional de la BD (borra y recrea tablas).