# 012 · Identidad, tema y configuración

**Estado:** implementado ✅

## Qué hace

Define la identidad visual de SIA (logo, favicon y página de entrada), ofrece tema claro/oscuro persistido entre sesiones y una pantalla de configuración para el perfil del usuario. La UI es responsive para usarse desde el celular en la red local.

## Por qué

Cierra el círculo de producto: una apariencia coherente con branding propio, preferencia de tema recordada y una página de ajustes básicos hacen que el sistema se sienta terminado en lugar de un conjunto de tablas.

## Criterios de aceptación

- [x] El tema claro/oscuro se alterna desde la cabecera y persiste entre recargas y sesiones (clave `sia-theme`).
- [x] La elección de tema aplica sin parpadeo al cargar la página.
- [x] Logo y favicon SIA están en `frontend/public/` y se muestran en la app.
- [x] La página `configuracion` (`/configuracion`) muestra y edita los datos del perfil del usuario autenticado.
- [x] Los metros del panel (sidebar, cabecera, tablas) son responsive y se usan desde el celular.
- [x] El código visual se apoya en los tokens de `frontend/src/styles.css` y en componentes shadcn/ui, sin estilos sueltos por pantalla.

## Fuera de alcance

- Multi-idioma (la app es solo español).
- Personalización de color por institución (los temas son fijos claro/oscuro).
- Avatar de usuario con foto subido (el campo `foto_url` existe, sin flujo de subida).