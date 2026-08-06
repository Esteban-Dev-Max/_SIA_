# 002 · Autenticación y RBAC — Tareas

Checklist derivada del `plan.md`. Todo el trabajo está terminado; los criterios de la spec se cumplen.

- [x] Crear `backend/routes/auth.js` con `POST /login` (validación bcrypt, estado activo, JWT de 8 h).
- [x] Crear `backend/middleware/auth.js` (`verifyToken`) y `requireRole(...)` con respuesta 401/403 en español.
- [x] Aplicar `verifyToken` + `requireRole` en todos los routers montados en `backend/index.js`.
- [x] Sembrar contraseñas demo con hash bcrypt en `seed.js`.
- [x] Implementar guardas en el frontend: `src/lib/guard.ts`, `src/components/AuthGate.tsx` y `requireRole` en `beforeLoad` de cada layout `route.tsx` por rol.
- [x] Guardar `token`/`user` en `localStorage` o `sessionStorage` según preferencia, y `getToken()` con prioridad localStorage.
- [x] Pantalla de login con redirección tras iniciar sesión y cierre de sesión que limpia el almacenamiento.
- [x] Validar: 401 sin token, 403 con rol ajeno y redirecciones de rutas protegidas.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.