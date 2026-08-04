# AGENTS.md — Guía para agentes de IA en SIA

## 1. Visión General del Proyecto

**SIA (Sistema Integral Académico)** es una plataforma web full-stack para instituciones educativas. Centraliza la gestión de **estudiantes, profesores, carreras, materias, matrículas, notas y asistencia** en una sola aplicación, con una interfaz moderna y tres paneles según el rol del usuario:

- **Admin** (`/admin`): gestiona usuarios, carreras, materias y matrículas.
- **Profesor** (`/profesor`): registra notas (parcial, medio, final) y marca asistencia por materia.
- **Estudiante** (`/estudiante`): consulta sus notas, promedio general y historial de asistencia.

Arquitectura cliente-servidor en monorepo:

```
SIA/
├── frontend/   # React 19 + TanStack Start + TypeScript + Tailwind 4 (puerto 8080)
└── backend/    # Express + MySQL, JavaScript (ESM) (puerto 3001)
```

La app está pensada para correr en red local (XAMPP/MySQL + dos terminales) y puede accederse desde el celular en la misma red.

---

## 2. Stack Tecnológico

### Backend (`backend/`)
- **Node.js 18+** con módulos **ESM** (`"type": "module"`, imports con extensión `.js`).
- **Express 4** — API REST.
- **mysql2/promise** — `pool` de conexiones con `namedPlaceholders`.
- **bcryptjs** — hash de contraseñas (`bcrypt.hash(password, 10)`).
- **jsonwebtoken** — JWT con `expiresIn: "8h"`.
- **cors + dotenv** — CORS por orígenes y variables de entorno.
- Scripts: `npm run dev` (watch), `npm run migrate`, `npm run seed`.

### Frontend (`frontend/`)
- **React 19** + **TypeScript 5** (modo estricto) + **Vite 8**.
- **TanStack Start** (`@tanstack/react-start`) como framework full-stack; **TanStack Router** v1 (file-based routing con `routeTree.gen.ts`) y **TanStack Query** v5.
- **Tailwind CSS 4** (plugin `@tailwindcss/vite`, `lightningcss` como transformer).
- **shadcn/ui** sobre **Radix UI** — componentes en `src/components/ui/`.
- **lucide-react** (iconos), **sonner** (toasts), **zod** + **react-hook-form** (disponibles, aún sin uso en rutas actuales).
- **recharts**, **date-fns**, **clsx/tailwind-merge** (`cn()`).
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run format`.
- Alias de import: `@/` → `src/`.

### Base de datos
- **MySQL 8**, BD por defecto `academico` (configurable vía `.env`).
- Tablas: `usuarios`, `carreras`, `materias`, `matriculas`, `notas`, `asistencia`.
- Migración: `backend/migrations/001_init.sql` (se ejecuta con `npm run migrate`).
- Seed: `backend/seed.js` crea los usuarios demo (admin/profesor/estudiante).

### Comandos de verificación
- Backend: `npm run migrate` y `npm run seed` desde `backend/` (requiere MySQL activo).
- Frontend: `npm run lint` y `npm run build` desde `frontend/`.
- Ambos tienen `npm run dev` para desarrollo.

---

## 3. Convenciones de Código y Estilo

### Nombramiento

**Backend (JavaScript):**
- Archivos: `camelCase.js` (rutas, middleware, utilidades): `routes/admin.js`, `middleware/auth.js`, `lib/lan.js`.
- Router Express: constante `const r = Router();` y `export default r;`.
- Parámetros de request: `req`, `res`, `next`. Respuestas exitosas con `res.json(...)`, errores con `res.status(code).json({ error: "mensaje" })`.
- Variables del cuerpo: desestructurar en una línea: `const { nombre, email, rol } = req.body;`.
- Campos de BD en `snake_case` (`password_hash`, `estudiante_id`, `carrera_nombre`).

**Frontend (TypeScript/React):**
- Rutas: `kebab-case.tsx` en `src/routes/` (`login.tsx`, `admin.tsx`, `profesor.tsx`, `estudiante.tsx`).
- Componentes reutilizables: `PascalCase.tsx` en `src/components/` (`PanelShell.tsx`, `DataTable.tsx`, `StatCard.tsx`).
- UI de terceros (shadcn): en `src/components/ui/` — **no editar** salvo necesidad real.
- Libs/helpers: `camelCase.ts` en `src/lib/` (`api.ts`, `guard.ts`, `utils.ts`, `error-page.ts`).
- Tipos de entidad: declarados con `type` cerca del componente que los usa (`type Usuario`, `type Materia`, `type NotaRow`).
- Funciones de componente: `function Nombre(...)` (no arrow const), y handlers `async function load()`, `add()`, `remove()`.
- Iconos de lucide: importar por nombre y usar con tamaño `h-4 w-4`.
- Estado local con `useState` + `useEffect`; clases condicionales con `cn(...)` de `@/lib/utils`.

### Arquitectura y organización

**Backend:**
- `routes/` — un archivo por dominio y rol (auth, admin, profesor, estudiante).
- `middleware/` — `auth` (verifica JWT), `requireRole(...roles)`, `asyncHandler` (envuelve rutas async).
- `lib/` — utilidades sin dependencias de Express (`lan.js`).
- `db.js` — exporta el `pool` compartido de MySQL.
- `index.js` — configura la app, CORS, monta rutas bajo `/api/*` y el manejador central de errores.
- Endpoints agrupados por rol: `POST /api/auth/login`, `/api/admin/*`, `/api/profesor/*`, `/api/estudiante/*`.
- Cada router protege sus rutas al inicio: `r.use(auth, requireRole("admin"))`.
- Consultas con **sentencias preparadas** (`?` placeholders) y `pool.query(sql, [params])`.

**Frontend:**
- Ruta = archivo en `src/routes/`, con `createFileRoute("/path")({ beforeLoad, component })`.
- `beforeLoad` usa `requireRole("rol")` de `@/lib/guard` para proteger cada panel.
- Llamadas API siempre a través de `api<T>()` de `@/lib/api` (inyecta el token automáticamente).
- La sesión vive en `localStorage` (`token` y `user`), gestionada por `api.ts`.
- Componentes compartidos (`PanelShell`, `DataTable`, `StatCard`) encapsulan el layout, las tablas y las tarjetas de métricas.
- UI 100% en **español**.

### Código limpio y legible
- Sin comentarios a menos que expliquen una decisión no obvia (p. ej. `lib/error-capture.ts`, `lib/lan.js`).
- Errores con mensajes cortos y en español (`"Faltan datos"`, `"Credenciales inválidas"`, `"No autorizado"`, `"Prohibido"`).
- `console.error(err)` en el manejador de errores central; toasts con `toast.success(...)` para feedback de usuario.
- Formateo con **Prettier** (hay script `npm run format`); ESLint en frontend con reglas de `react-hooks` y `react-refresh`.
- En rutas async del backend preferir `asyncHandler(async (req, res) => {...})` para evitar que errores tumben el proceso.

---

## 4. Instrucciones para Agentes de IA

### Cómo escribir o modificar código
1. **Lee el contexto antes de tocar nada**: revisa el router (ruta), el/los componente(s) compartidos y el endpoint correspondiente del backend antes de editar.
2. **Respeta los patrones existentes**:
   - Backend: agrega endpoints dentro del router del rol correcto (admin/profesor/estudiante), protegidos con `auth` + `requireRole`. Usa `asyncHandler` para rutas async y `pool.query` con placeholders.
   - Frontend: nueva vista → nuevo archivo en `src/routes/`; lógica reutilizable → `src/lib/`; UI reutilizable → `src/components/`. Usa `api<T>()`, `cn()` y los componentes de `ui/`.
3. **Sigue las convenciones de estilo** de la sección 3 (nombramiento, orden de imports, español en la UI, tipos con `type`).
4. **No mezcles estilos**: si una ruta usa `useState/useEffect`, no introduzcas otro patrón de manejo de estado en la misma ruta salvo que sea necesario y consistente.

### Mantener coherencia y no romper funcionalidad
- **No renombrar claves de sesión** (`token`, `user`) ni el formato de respuestas del backend: el frontend depende de `{ error }`, `{ ok: true }`, `{ id, nombre, email, rol }`, etc.
- **No cambiar la firma del JWT** ni el payload (`{ id, rol, nombre, email }`): `middleware/auth.js` y `lib/guard.ts` lo consumen.
- **No alterar el esquema de BD** sin actualizar `backend/migrations/001_init.sql` y el seed. Si agregas columnas/tablas, documenta la migración.
- **CORS**: al agregar orígenes, recuerda que `lib/lan.js` ya permite localhost e IPs de red local; solo usa `CORS_ORIGIN` para casos extra.
- **Prueba de regresión mínima**: tras cambios, ejecuta `npm run lint` (frontend) y `npm run build` (frontend). En backend, verifica que `npm run migrate` y `npm run seed` pasan y que el servidor arranca.
- **No rompas el login ni los guards**: cualquier cambio en auth debe conservar los tres roles (admin/profesor/estudiante) y el redireccionamiento por rol.

### Manejo de estados y validaciones
- **Estado del frontend**: sesión en `localStorage` vía `api.ts` (`setSession`/`clearSession`/`getUser`). No dupliques la fuente de verdad del usuario; léela con `getUser()`.
- **Carga de datos**: usa `useState` + `useEffect` con `load()` reutilizable; recarga después de mutaciones (`await api(...); load();`).
- **Manejo de errores**: enmarca llamadas API en `try/catch` y muestra `err.message` (usar `err instanceof Error ? err.message : "Error"`); muestra errores de formulario con clases `text-destructive`.
- **Validación backend (siempre)**: valida manualmente en cada endpoint — campos requeridos → `400 { error: "Faltan datos" }`; credenciales inválidas → `401`; sin autorización → `403`. Nunca confíes solo en la validación del frontend.
- **Sanitización**: usa parámetros preparados de `mysql2` (`?`) en TODAS las consultas; jamás concatenes valores del usuario en SQL.
- **Seguridad**: no loguees ni devuelvas `password_hash`; nunca expongas `JWT_SECRET`; contraseñas siempre con `bcrypt.hash(..., 10)`.
- **Integridad de notas/asistencia**: los endpoints de profesor deben verificar que la materia pertenece al profesor (`WHERE ... AND mt.profesor_id = ?`) antes de escribir — conserva esa verificación.
- **Upserts**: para notas y asistencia usa `ON DUPLICATE KEY UPDATE` (claves únicas `uq_matricula`, `uq_asistencia`) en lugar de insertar duplicados.
