# 012 · Identidad, tema y configuración — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

La identidad vive en el frontend: tokens CSS en oklch en `frontend/src/styles.css` (tema claro/oscuro con clase `.dark`), tipografías Inter/Plus Jakarta Sans/JetBrains Mono, y los assets de marca en `frontend/public/`. El tema se persiste en `localStorage` (`sia-theme`) y se aplica antes del render para evitar parpadeo; la configuración del perfil usa los endpoints del usuario autenticado.

## Implementación

1. **Tema** — `frontend/src/lib/theme.ts` (lectura/persistencia de `sia-theme`), `frontend/src/components/ThemeProvider.tsx` y `ThemeToggle.tsx` (alternador en la cabecera del `PanelShell`); HTML inicial con clase `.dark` para que no haya flash.
2. **Tokens y estilos** — variables CSS (oklch) en `frontend/src/styles.css`: fondo claro/oscuro, primario violeta, semánticos success/warning/info, radios y animaciones (fade-in, slide-up, scale-in); utilidades propias `mesh-bg`, `glass-card`, `gradient-text`.
3. **Branding** — logo y favicon en `frontend/public/logo.png`; colores, título SIA y layout en `__root.tsx` / landing `index.tsx`.
4. **Configuración** — `frontend/src/routes/configuracion.tsx`: consulta y edición de los datos del perfil (`usuarios`), con persistencia vía API; la ruta usa el token del usuario actual.
5. **Responsive** — sidebar colapsable (`PanelShell` + hooks) y tablas con scroll horizontal para el uso desde el celular.

## Decisiones

- **Tema con clase `.dark` + localStorage** — patrón estándar de shadcn, sin dependencia de librería de temas (se descartó mantener tema en el servidor: no hace falta y complica el SSR).
- **Script de tema antes del render** — para evitar flash de tema equivocado al cargar, la clase se aplica de forma temprana leyendo `sia-theme`.
- **Configuración como página propia del usuario** — separada de los paneles por rol para no mezclar ajustes de perfil con el dominio académico.

## Riesgos

- **Flash de tema claro al cargar en oscuro** — mitigado aplicando la clase antes del primer render desde `theme.ts`.
- **Tokens duplicados entre CSS y clases tailwind** — los tokens viven solo en `styles.css` y se consumen por `@theme inline`; no se definen colores ad hoc en los componentes.