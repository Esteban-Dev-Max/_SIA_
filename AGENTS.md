# SIA — Sistema Integral Académico

Aplicación web full-stack para instituciones educativas: centraliza la gestión de estudiantes, profesores, carreras, materias, notas, asistencia, tareas y comunicaciones, con paneles dedicados por rol y un chatbot. Los mensajes de la UI y los errores de la API están en **español**.

## Stack
- Lenguaje: JavaScript (backend) y TypeScript 5 estricto (frontend)
- Framework / runtime: Node 20+ — Express 4 (backend, ESM) + React 19 con Vite 8 y TanStack Start/Router/Query (frontend)
- Base de datos: MySQL 8 (XAMPP), accede con `mysql2/promise` y sentencias preparadas
- Tests: no existe suite de pruebas

## Comandos
- **Backend** (desde `backend/`): `npm run dev` — arranca la API en `http://localhost:3001` (`node --watch`). `npm run start` — `node index.js` (lo que corre PM2 en producción). `npm run migrate` — crea/borra y recrea todas las tablas (destructivo). `npm run seed` — inserta datos demo (idempotente).
- **Frontend** (desde `frontend/`): `npm run dev` — arranca la UI en `http://localhost:8080`.
- `npm run lint` — revisa el estilo (ESLint + Prettier), 0 errores esperados. Se corre en `frontend/`.
- `npm run build` — compila para producción (TanStack Start + Nitro, preset `node-server`). En el servidor PM2 corre directamente `frontend/.output/server/index.mjs`. Verificación de QA junto con `lint`.
- **No hay script de typecheck**; `vite build` es la verificación más cercana del frontend.

## Estructura del proyecto
- `backend/` — API REST Express. `index.js` (entrada, monta routers bajo `/api/*`; aborta solo si **falta** `JWT_SECRET`, no si es el placeholder), `db.js` (pool MySQL), `routes/` (auth, admin, profesor, acudiente, notas, asistencia, tareas, calendario, chatbot, chat, mensajes, notificaciones), `middleware/` (auth.js con `verifyToken`+`requireRole`, asyncHandler), `lib/` (notas.js — ponderación única, horario.js, rateLimit.js, lan.js, notificar.js, chatbotEngine.js), `migrations/001_init.sql`, `seed.js`.
- **No hay `routes/estudiante.js`**: los endpoints de estudiante viven dentro de `notas.js`, `asistencia.js`, `tareas.js`, etc., y ramifican con `if (req.user.rol === "estudiante")`.
- `frontend/` — React 19 + TanStack (SSR). Rutas por archivo en `src/routes/` (kebab-case), paneles por rol en `src/routes/<rol>/`, capa de datos/API en `src/lib/`, componentes en `src/components/` (incluye shadcn/ui en `ui/`).
- Ejecuta backend y frontend desde **sus propios directorios** (dos terminales); son paquetes npm independientes con `node_modules` separados.

## Despliegue en el servidor (PM2 + Tailscale Funnel)
- PM2 gestiona los procesos de la app: `sia-backend` (`backend/index.js`) y `sia-frontend` (`frontend/.output/server/index.mjs`).
- La publicación pública la hace **Tailscale Funnel**: URL estable `https://sia.<tailnet>.ts.net` (sin dominio, no cambia al reiniciar). Corre como servicio systemd (NO en PM2). Config: `/` → `http://127.0.0.1:8080` y `/api` → `http://127.0.0.1:3001/api`. Ojo: Funnel **quita el prefijo del path** al enrutar, por eso el target del backend debe incluir `/api`. Se gestiona con `sudo tailscale funnel ...`; persiste entre reinicios.
- Los antiguos túneles efímeros de Cloudflare (`sia-backend-tunnel`, `sia-frontend-tunnel`) están **detenidos** en PM2; rollback con `pm2 restart`.
- Resolución de `api()` (`frontend/src/lib/api.ts`): navegador sobre **HTTPS** (Funnel) → paths **relativos** `/api/*` (misma-origen, sin CORS); navegador sobre **HTTP** (localhost/IP LAN) → `window.location.hostname:3001`; **SSR** → `VITE_API_URL` (ahora `http://localhost:3001`, loopback directo).
- **Seguridad del despliegue público**: Funnel no tiene muro de autenticación (a diferencia de Cloudflare Access) — la URL expone la app a internet. Las cuentas del seed son **dev-only**: en producción se **rotan sus contraseñas** (no quedan como `admin123`). `/api/chat` y `/api/chatbot/pregunta` tienen límite por usuario (15 req/min, in-memory). Para un muro de acceso real se requiere un reverse proxy con basic auth o Cloudflare Access (necesita dominio).

## Chatbot / IA (Gemini)
- `POST /api/chat` (`routes/chat.js`) llama a Gemini con `@google/generative-ai`; si no hay `GEMINI_API_KEY` o la llamada falla (404/429/timeout), **cae silenciosamente** al motor por palabras clave (`lib/chatbotEngine.js`) — nunca responde 500. Un modelo inválido o una key mala se notan como respuestas "de robot", sin error visible.
- El modelo se configura con `GEMINI_MODEL` (por defecto `gemini-3.5-flash`). Si lo cambias, verifica que exista para tu cuenta: 404 = modelo no disponible.
- Tanto `/api/chat` como `/api/chatbot/pregunta` aplican `crearLimitePeticiones()` (`lib/rateLimit.js`) — 15 req/min por usuario+IP, in-memory.

## Convenciones
- Backend **ESM**: usa extensiones `.js` explícitas en los imports relativos (p. ej. `import { pool } from "../db.js"`).
- Todo acceso a BD usa el `pool` de `mysql2/promise` de `../db.js`, siempre con **sentencias preparadas** y placeholders `?`.
- Envuelve cada handler async de ruta con `asyncHandler` de `../middleware/asyncHandler.js`; un handler async crudo puede tumbar el proceso.
- Auth: cada router llama `r.use(verifyToken)` (`middleware/auth.js`) y controla el rol con `requireRole(...)`. `req.user.id` = id del usuario autenticado. `verifyToken` además revalida contra la BD (estado `activo` y rol actual) en cada request.
- Los errores son JSON `{ error: "<mensaje en español>" }`. Estados: 400 entrada inválida, 401 token ausente/inválido, 403 prohibido, 500 interno.
- Emite notificaciones vía `notificar(usuario_id, titulo, mensaje, tipo)` de `../lib/notificar.js` (`tipo`: sistema|nota|tarea|mensaje|evento).
- Frontend: alias de import `@` → `src`. Usa `api()` de `@/lib/api` para todos los fetch (SSR usa `VITE_API_URL`; el navegador, relative `/api` en HTTPS o `window.location.hostname:3001` en HTTP).
- Las contraseñas siempre se almacenan con hash bcrypt (10 rondas). Token/usuario en `localStorage` (`token`, `user`) o `sessionStorage`; `getToken()` lee localStorage primero. Clave de tema: `sia-theme`.
- Prettier se aplica vía ESLint: printWidth **100**, comillas dobles, `;`.
- Crea páginas protegidas con un layout `route.tsx` por rol: `route.tsx` con `requireRole("...")` en `beforeLoad` y envuelto en `<AuthGate>` + `<PanelShell>`.

## No hagas
- No edites a mano `routeTree.gen.ts` ni los contenidos de `.tanstack/` (generados por el dev server/plugin). Reinicia `npm run dev` para regenerarlos.
- No uses `localhost` en llamadas a la API (rompe el uso en red local); confía en la resolución automática de `@/lib/api`.
- No importes `server-only` (ESLint lo prohíbe con `no-restricted-imports`). Para código solo-server usa `*.server.ts`.
- No subas archivos `.env*` al repositorio. Ojo: **`frontend/.env` ya está versionado** (por el `VITE_API_URL` de SSR) y `backend/.env.example` llegó a contener una key real de Gemini — mantenlos sin secretos reales.
- La ponderación de la nota (25% / 25% / 20% / 30%) tiene **dos** fuentes que deben mantenerse sincronizadas: `backend/lib/notas.js` (`PONDERACION`, única fuente del backend) y `frontend/src/routes/profesor/index.tsx:82` (fórmula hardcodeada). Cambia en ambas.
- No cambies `migrate.js` para que deje de ser destructivo; `npm run migrate` borra y recrea todas las tablas a propósito.
- No dejes `JWT_SECRET` con el valor del placeholder de `.env.example`: `index.js` solo aborta si la variable falta, no si es la predeterminada. En un despliegue público (túneles) cualquiera que lea el repo puede forjar tokens.

## Flujo de trabajo
- Antes de una tarea no trivial, propón un plan y espera mi OK.
- Una tarea a la vez; al terminar, dime qué cambiaste para que lo revise.
- Si no estás seguro al 80%, pregunta. No inventes.

## Documentación
- `README.md` (raíz) — descripción general, instalación, cuentas demo y orden de arranque (MySQL/XAMPP → migrate → seed → dev).
- `backend/README.md` — guía de red local/firewall.
- `migrations/001_init.sql` — esquema relacional de la BD (borra y recrea tablas).