# 001 · Infraestructura — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] Crear `backend/` como paquete npm ESM con Express 4, `db.js` (pool mysql2), `index.js` y manejo de errores JSON en español.
- [x] Escribir `migrations/001_init.sql` con las 14 tablas relacionales y `migrate.js` destructivo.
- [x] Crear `seed.js` idempotente con datos demo reales de los 4 roles.
- [x] Implementar CORS de red local en `backend/lib/lan.js` (localhost + IPs privadas).
- [x] Configurar `frontend/vite.config.ts` (alias `@/`, SSR TanStack Start, servidor `0.0.0.0:8080`) y `src/lib/api.ts` con resolución automática `hostname:3001`.
- [x] Crear plantillas `.env.example` en backend y frontend.
- [x] Escribir README raíz con instalación, cuentas demo, orden de arranque y acceso desde el celular.
- [x] Validar: `npm run migrate` + `npm run seed` (backend) y `npm run lint` + `npm run build` (frontend).

## Mantenimiento (checklist recurrente)

- [x] Al tocar dependencias del backend o el frontend, revalidar el flujo `migrate` → `seed` → `dev` completo.
- [x] No editar `routeTree.gen.ts` / `.tanstack/` a mano; reiniciar el dev server para regenerarlos.