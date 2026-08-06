# 002 · Autenticación y RBAC

**Estado:** implementado ✅

## Qué hace

Permite iniciar sesión con correo y contraseña, obtener un token JWT de 8 horas y acceder solo a las secciones según el rol (admin, profesor, estudiante, acudiente). La sesión se recuerda entre recargas (`localStorage`) o solo durante la pestaña (`sessionStorage`), según lo elija el usuario. Tanto la API como la interfaz rechazan los intentos de un rol ajeno.

## Por qué

Es la puerta de entrada de todo el sistema. Sin control de acceso por rol, cualquiera podría ver o editar información de otros usuarios; la separación por paneles y la verificación de cada endpoint son la base de la seguridad del producto.

## Criterios de aceptación

- [x] `POST /api/auth/login` responde 200 con `{ token, user }` cuando el correo, la contraseña (bcrypt) y el estado `activo` son válidos.
- [x] Credenciales incorrectas responden 401 con `{ error: "<mensaje en español>" }`, y cuentas inactivas quedan fuera.
- [x] El token expira a las 8 h (`expiresIn: "8h"`).
- [x] Todos los endpoints (excepto `/auth/login`) devuelven 401 sin token válido y 403 cuando el rol no tiene permiso (`requireRole`).
- [x] Rutas protegidas del frontend redirigen a `/login` cuando no hay sesión válida y a `/` cuando el rol no coincide.
- [x] Cerrar sesión limpia el token de `localStorage`/`sessionStorage` y vuelve a `/login`.

## Fuera de alcance

- Registro público de cuentas (los usuarios los crea el admin, ver feature 003).
- Recuperación de contraseña por correo (en backlog).
- 2FA / OAuth / sesiones múltiples o revocación de tokens por servidor.