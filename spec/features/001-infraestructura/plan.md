# 001 · Infraestructura — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Repositorio monorepo sin monorepo: `backend/` y `frontend/` son paquetes npm independientes con sus propios `node_modules`, cada uno arrancado desde su carpeta. El backend es una API REST Express con pool de MySQL (`mysql2/promise`) y sentencias preparadas; el frontend trabaja con Vite 8 y TanStack Start (SSR, enrutado por archivos). La BD se crea con un único script SQL destructivo ejecutado por `migrate.js`.

## Implementación

1. **Backend** — `backend/index.js` (app Express, CORS, montado de routers y manejo de errores), `backend/db.js` (pool con `decimalNumbers: true`), `backend/migrate.js` que ejecuta `backend/migrations/001_init.sql` (CREATE DATABASE IF NOT EXISTS `academico` + 14 tablas con claves foráneas, borrado en orden hijas→padres).
2. **Seed** — `backend/seed.js` inserta los datos demo usando `INSERT ... ON DUPLICATE KEY UPDATE` (idempotente) y hashea las contraseñas demo con bcrypt.
3. **CORS red local** — `backend/lib/lan.js` permite explícitamente orígenes de `localhost` e IPs privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x) en el puerto del frontend; `CORS_ORIGIN` (separado por comas) para casos especiales.
4. **Frontend** — `frontend/vite.config.ts` configura el alias `@/` → `src`, SSR con TanStack Start y el servidor en `0.0.0.0:8080`; `frontend/src/lib/api.ts` resuelve la API usando `window.location.hostname` en el puerto `:3001`.
5. **Config** — plantillas `.env.example` en ambos paquetes (backend: `PORT`, `FRONTEND_PORT`, `DB_*`, `JWT_SECRET`; frontend: `VITE_API_URL` opcional).

## Decisiones

- **Backend ESM + `.js` explícitos** — Node 20 soporta ESM nativo; las extensiones explícitas en imports relativos cumplen el estándar y evitan ambigüedades.
- **MySQL 8 vía XAMPP + `mysql2/promise`** — el proyecto objetivo usa XAMPP en local; se elige el pool con promesas y placeholders `?` para seguridad y simplicidad (se descartó un ORM: no aporta nada y añade complejidad).
- **Mismo host para API y UI en red local** — en vez de URLs hardcodeadas, `api.ts` usa `window.location.hostname:3001`, así el celular funciona sin tocar configuración (se descartó `http://localhost:3001` que rompe el uso en red).
- **`migrate` destructivo a propósito** — borra y recrea todas las tablas siempre; se descartó hacer migraciones incrementales por el tamaño del proyecto.
- **Prettier vía ESLint** — single source: `npm run lint` cubre estilo y linting (printWidth 100, comillas dobles, `;`).

## Riesgos

- **MySQL apagado o con credenciales distintas** — `db.js` falla al conectar; el README y `.env.example` documentan la config de XAMPP (usuario `root`, password vacío por defecto).
- **Firewall de Windows** bloquea puertos desde el celular — documentado en `backend/README.md` con reglas `netsh` para `:8080` y `:3001`.
- **`routeTree.gen.ts` y `.tanstack/` generados** — no se editan a mano; se regeneran con el dev server.