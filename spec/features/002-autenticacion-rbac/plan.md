# 002 · Autenticación y RBAC — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

Autenticación clásica con JWT en el encabezado `Authorization: Bearer <token>` y capa de autorización en dos niveles: middleware por router (`verifyToken` + `requireRole`) en el backend, y guardas de rutas (`AuthGate` + `requireRole` en `beforeLoad`) en el frontend. Las contraseñas se almacenan siempre con hash bcrypt de 10 rondas.

## Implementación

1. **Login** — `backend/routes/auth.js`: verifica credenciales contra `usuarios` (bcrypt `compare`), exige `estado = 'activo'`, y firma el JWT con `jsonwebtoken` (`expiresIn: "8h"`). Las contraseñas demo se siembran hasheadas (seed).
2. **Verificación** — `backend/middleware/auth.js` (`verifyToken`): decodifica el JWT, carga a `req.user`; 401 si falta/invalido. `requireRole(...roles)` devuelve 403 si `req.user.rol` no está permitido.
3. **Aplicación por router** — cada router montado en `backend/index.js` bajo `/api/*` aplica `verifyToken` y después `requireRole` con los roles que le corresponden a su ruta.
4. **Sesión y guardas frontend** — `frontend/src/lib/api.ts` adjunta el token de `getToken()` (lee `localStorage` antes que `sessionStorage`); en el login se guarda `token` y `user`. `frontend/src/lib/guard.ts` y `frontend/src/components/AuthGate.tsx` validan la sesión y redirigen; los layouts `route.tsx` de cada rol ejecutan `requireRole("...")` en `beforeLoad`.

## Decisiones

- **JWT 8 h + validación en cada petición** — sin estado de servidor para las sesiones; suficiente para la red local, con `sessionStorage` opcional (se descartó persistir sesiones en BD: el tamaño del proyecto no lo justifica).
- **bcryptjs (10 rondas)** — librería en JS puro (sin compilación nativa) frente a `bcrypt`; equivalencia de seguridad suficiente para el caso de uso.
- **RBAC con ENUM de BD + dos capas** — el rol vive en `usuarios.rol` y se valida en backend y frontend; el frontend redirige y el backend rechaza (defensa en profundidad).
- **Token por header, no por cookie** — ruta única de login con JWT en `Authorization`, para simplificar el modo SSR de TanStack Start y la sincronía con `localStorage`.
- **Sesión recordada u opcional** — según la casilla del formulario de ingreso; la persistencia guarda `token` y `user`.

## Riesgos

- **Token robado sin expiración** — mitigado con expiración de 8 h y cierre por el usuario; no hay revocación por servidor.
- **JWT_SECRET débil o default** — `.env.example` marca reemplazar con una cadena larga y aleatoria; nunca subir `.env`.
- **Rol estático al loguearse** — si el admin cambia el rol mientras el usuario está conectado, este lo conserva hasta volver a iniciar sesión (aceptado).