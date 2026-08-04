# AGENTS.md — Guía para agentes de IA en SIA

Guía técnica interna para **cualquier IA o desarrollador** que abra el proyecto a futuro. Contiene el mapa completo de la API, el esquema relacional de la base de datos, las convenciones de código y las reglas de seguridad que deben mantenerse.

---

## 1. Visión General del Proyecto

**SIA (Sistema Integral Académico)** es una plataforma web full-stack para instituciones educativas. Centraliza la gestión de **estudiantes, profesores, carreras/grados, materias, grupos, matrículas, notas, asistencia, tareas, eventos, mensajería y notificaciones** en una sola aplicación, con paneles según el rol del usuario:

- **Admin** (`/admin`): usuarios (CRUD), carreras/grados, materias, grupos, matrículas, vinculación acudiente–estudiante y estadísticas.
- **Profesor** (`/profesor`): planilla de calificaciones (ponderación 25/25/20/30), asistencia diaria y tareas (creación, revisión y calificación de entregas).
- **Estudiante** (`/estudiante`): notas y promedio, histórico de asistencia, tareas con entrega, calendario y chatbot "Asistente SIA".
- **Acudiente** (`/acudiente`): monitoreo del rendimiento de sus estudiantes vinculados, alertas de inasistencia y boletín imprimible.

Arquitectura cliente-servidor en monorepo:

```
SIA/
├── frontend/   # React 19 + TanStack Start + TypeScript + Tailwind 4 (puerto 8080)
└── backend/    # Express + MySQL, JavaScript (ESM) (puerto 3001)
```

La app está pensada para correr en red local (XAMPP/MySQL + dos terminales) y puede accederse desde el celular en la misma red (CORS por IPs privadas en `lib/lan.js`).

---

## 2. Stack Tecnológico

### Backend (`backend/`)
- **Node.js 20+** con módulos **ESM** (`"type": "module"`, imports con extensión `.js`).
- **Express 4** — API REST.
- **mysql2/promise** — `pool` de conexiones con `namedPlaceholders` y **`decimalNumbers: true`** (los DECIMAL llegan como número, no string — no romper este flag ni el fix de `.toFixed`).
- **bcryptjs** — hash de contraseñas (`bcrypt.hash(password, 10)`).
- **jsonwebtoken** — JWT con `expiresIn: "8h"`.
- **cors + dotenv** — CORS por orígenes y variables de entorno.
- Scripts: `npm run dev` (watch), `npm run migrate`, `npm run seed`, `npm start`.

### Frontend (`frontend/`)
- **React 19** + **TypeScript 5** (modo estricto) + **Vite 8**.
- **TanStack Start** (`@tanstack/react-start`) como framework full-stack con SSR; **TanStack Router** v1 (file-based routing con `routeTree.gen.ts` generado) y **TanStack Query** v5.
- **Tailwind CSS 4** (plugin `@tailwindcss/vite`, `lightningcss` como transformer).
- **shadcn/ui** sobre **Radix UI** — componentes en `src/components/ui/` (no editar salvo necesidad real).
- **lucide-react** (iconos), **sonner** (toasts), **date-fns** (fechas/es), **recharts**, **zod** + **react-hook-form** (disponibles en el proyecto).
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run format`.
- Alias de import: `@/` → `src/`.

### Base de datos
- **MySQL 8**, BD por defecto `academico` (configurable vía `.env`).
- 14 tablas relacionales (ver sección 4).
- Migración: `backend/migrations/001_init.sql` (se ejecuta con `npm run migrate`; **es destructiva**: hace DROP de todas las tablas).
- Seed: `backend/seed.js` — idempotente, crea los 4 usuarios demo y datos de ejemplo.

---

## 3. Mapeo de la API Backend

Base: `http://localhost:3001`. Todas las rutas bajo `/api/*` se montan en `backend/index.js`.

**Autenticación:** header `Authorization: Bearer <token>`. El JWT se firma con payload `{ id, rol, nombre, correo, foto_url }` y expira en 8h.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login con `{ correo, password }` → `{ token, user }` |
| GET | `/api/auth/me` | JWT | Perfil del usuario autenticado |
| GET | `/health` | público | Estado del servidor (`{ ok: true }`) |

### `/api/admin` — JWT + `requireRole("admin")`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/stats` | Métricas del dashboard |
| GET | `/usuarios` | Lista de usuarios |
| POST | `/usuarios` | Crear usuario (nombre_completo, correo, password, rol) |
| PUT | `/usuarios/:id` | Editar usuario |
| GET/POST | `/carreras` | Listar / crear carrera-grado |
| PUT/DELETE | `/carreras/:id` | Editar / eliminar |
| GET/POST | `/materias` | Listar / crear materia |
| PUT/DELETE | `/materias/:id` | Editar / eliminar |
| GET/POST | `/grupos` | Listar / crear grupo (materia + profesor + periodo) |
| DELETE | `/grupos/:id` | Eliminar grupo |
| GET/POST | `/matriculas` | Listar / crear matrícula |
| DELETE | `/matriculas/:id` | Eliminar matrícula |
| POST | `/vincular-acudiente` | Vincular acudiente ↔ estudiante |

### `/api/profesor` — JWT + `requireRole("profesor")`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/grupos` | Grupos asignados al profesor |

### `/api/estudiante` — JWT + `requireRole("estudiante")`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notas` | Notas del estudiante autenticado (con definitiva y promedio) |
| GET | `/asistencia` | Resumen e histórico de asistencia del estudiante |

### `/api/acudiente` — JWT + `requireRole("acudiente")`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/estudiantes` | Estudiantes vinculados al acudiente |
| GET | `/resumen/:estudiante_id` | Notas ponderadas, promedio y asistencia (verifica vínculo → 403) |

### `/api/notas` — JWT + RBAC por endpoint
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/estudiante/:estudiante_id` | admin, profesor del grupo, el propio estudiante | Desglose de notas por materia |
| GET | `/grupo/:grupo_id` | admin, profesor del grupo | Planilla de notas del grupo |
| POST | `/guardar` | admin, profesor del grupo | Upsert de notas + cálculo de definitiva (25/25/20/30) + **notificación automática al estudiante** |

### `/api/asistencia` — JWT + RBAC
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/grupo/:grupo_id` | Planilla de asistencia del grupo (profesor/admin) |
| POST | `/registrar` | Upsert por matrícula+fecha (estados: `presente`, `ausente`, `tarde`, `excusa`) |
| GET | `/resumen/estudiante/:estudiante_id` | Resumen de asistencia del estudiante |

### `/api/tareas` — JWT + RBAC por endpoint
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/grupo/:grupo_id` | admin, profesor/estudiante del grupo | Tareas del grupo con indicadores de entrega |
| GET | `/estudiante` | estudiante | Tareas del estudiante autenticado |
| POST | `/` | admin, profesor del grupo | Crear tarea (notifica al grupo) |
| POST | `/:tarea_id/entregar` | estudiante matriculado | Entregar tarea (enlace + comentario) |
| GET | `/:tarea_id/entregas` | admin, profesor del grupo | Entregas recibidas |
| POST | `/calificar/:entrega_id` | admin, profesor del grupo | Calificar entrega con retroalimentación |

### `/api/calendario` — JWT
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/eventos` | Eventos en un rango (tareas con fecha límite + `eventos_calendario`) |
| POST | `/eventos` | Crear evento institucional (admin/profesor) |

### `/api/chatbot` — JWT
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/pregunta` | `{ pregunta }` → detección de intención por palabras clave (tolera tildes) y respuesta **personalizada con datos reales del usuario** según rol |

### `/api/mensajes` — JWT
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/contactos` | Usuarios contactables |
| GET | `/conversaciones/:usuario_id` | Conversaciones del usuario |
| GET | `/conversacion/:usuario_id/:contacto_id` | Hilo entre dos usuarios |
| POST | `/enviar` | Enviar mensaje (notifica al destinatario) |
| PUT | `/leidas/:usuario_id/:contacto_id` | Marcar leídos los mensajes de un contacto |

### `/api/notificaciones` — JWT
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/:usuario_id` | Notificaciones del usuario (tipo: `sistema`, `nota`, `tarea`, `mensaje`, `evento`) |
| PUT | `/marcar-leida/:id` | Marcar una como leída |
| PUT | `/marcar-todas/:usuario_id` | Marcar todas como leídas |

**Convención de errores:** respuestas con `{ error: "mensaje" }` y códigos HTTP: `400` Faltan datos / ID inválido, `401` No token / Token inválido / Credenciales inválidas, `403` Prohibido / No autorizado, `404` recurso no encontrado, `500` "Error interno del servidor" (genérico, **nunca** expone `err.message` de MySQL).

---

## 4. Esquema Relacional de la Base de Datos

BD `academico` (utf8mb4). 14 tablas, claves foráneas en negrita.

```
instituciones(id, nombre, correo, telefono, departamento, ciudad)

usuarios(id, nombre_completo, correo UNIQUE, password*, rol ENUM('admin','profesor','estudiante','acudiente'),
         foto_url, estado ENUM('activo','inactivo'), fecha_creacion)
         *columna "password" con hash bcrypt — nunca texto plano

carreras_grados(id, nombre, codigo UNIQUE)

materias(id, nombre, codigo UNIQUE, creditos, carrera_id → carreras_grados.id [SET NULL])

grupos(id, materia_id → materias.id [CASCADE], profesor_id → usuarios.id [CASCADE],
       periodo, horario)

matriculas(id, estudiante_id → usuarios.id [CASCADE], grupo_id → grupos.id [CASCADE],
           fecha_matricula, UNIQUE uq_matricula(estudiante_id, grupo_id))

notas(id, matricula_id → matriculas.id [CASCADE] UNIQUE (1:1), nota_1, nota_2, nota_3,
      examen_final, nota_definitiva, observaciones)
      Ponderación definitiva: nota_1*0.25 + nota_2*0.25 + nota_3*0.20 + examen_final*0.30

asistencia(id, matricula_id → matriculas.id [CASCADE], fecha,
           estado ENUM('presente','ausente','tarde','excusa'), observacion,
           UNIQUE uq_asistencia(matricula_id, fecha))

tareas(id, grupo_id → grupos.id [CASCADE], titulo, descripcion, fecha_entrega, puntaje_max)

entregas_tareas(id, tarea_id → tareas.id [CASCADE], estudiante_id → usuarios.id [CASCADE],
                archivo_url, fecha_entrega, calificacion, comentario, retroalimentacion,
                UNIQUE uq_entrega(tarea_id, estudiante_id))

eventos_calendario(id, titulo, descripcion, fecha_inicio, fecha_fin,
                   tipo ENUM('institucional','evaluacion','entrega','reunion'),
                   curso_id → carreras_grados.id [SET NULL])

mensajes(id, remitente_id → usuarios.id [CASCADE], destinatario_id → usuarios.id [CASCADE],
         contenido, leido TINYINT, fecha_envio)

notificaciones(id, usuario_id → usuarios.id [CASCADE], titulo, mensaje,
               tipo ENUM('sistema','nota','tarea','mensaje','evento'), leida, fecha_creacion)

acudiente_estudiante(id, acudiente_id → usuarios.id [CASCADE], estudiante_id → usuarios.id [CASCADE],
                     UNIQUE uq_acudiente_estudiante(acudiente_id, estudiante_id))
```

**Reglas de integridad críticas:**
- Las notas y la asistencia son **upserts** (`ON DUPLICATE KEY UPDATE` sobre `uq_matricula` / `uq_asistencia`) — nunca insertar duplicados.
- Cualquier escritura del profesor debe verificar la pertenencia: `WHERE g.profesor_id = ?` (o la matrícula del estudiante) antes de escribir.
- El acudiente solo lee estudiantes vinculados (`acudiente_estudiante` → 403 si no hay vínculo).
- Los valores DECIMAL llegan como `number` (por `decimalNumbers: true`) — respetar ese comportamiento en cálculos y formateos.

---

## 5. Convenciones de Código y Estilo

### Nombramiento

**Backend (JavaScript):**
- Archivos: `camelCase.js` (rutas, middleware, utilidades): `routes/admin.js`, `middleware/auth.js`, `lib/lan.js`.
- Router Express: constante `const r = Router();` y `export default r;`.
- Parámetros de request: `req`, `res`, `next`. Respuestas exitosas con `res.json(...)`, errores con `res.status(code).json({ error: "mensaje" })`.
- Variables del cuerpo: desestructurar en una línea: `const { nombre, correo, rol } = req.body;`.
- Validación de IDs con helper `parseId(value)` (entero positivo o `null` → 400).
- Campos de BD en `snake_case`; la contraseña se llama **`password`** (no `password_hash`) y nunca se devuelve ni se loguea.

**Frontend (TypeScript/React):**
- Rutas: `kebab-case.tsx` en `src/routes/` (`login.tsx`, `calendario.tsx`, `admin/academico.tsx`).
- Componentes reutilizables: `PascalCase.tsx` en `src/components/` (`PanelShell.tsx`, `DataTable.tsx`, `StatCard.tsx`, `AuthGate.tsx`).
- UI de terceros (shadcn): en `src/components/ui/` — **no editar** salvo necesidad real.
- Libs/helpers: `camelCase.ts` en `src/lib/` (`api.ts`, `guard.ts`, `utils.ts`, `error-page.ts`).
- Tipos de entidad: declarados con `type` cerca del componente que los usa (`type Usuario`, `type Materia`, `type NotaRow`).
- Funciones de componente: `function Nombre(...)` (no arrow const), handlers `async function load()`, `add()`, `remove()`.
- Iconos de lucide: importar por nombre y usar con tamaño `h-4 w-4`.
- Estado local con `useState` + `useEffect`; clases condicionales con `cn(...)` de `@/lib/utils`.

### Arquitectura y organización

**Backend:**
- `routes/` — un archivo por dominio y rol (auth, admin, profesor, estudiante, acudiente, notas, asistencia, tareas, calendario, chatbot, mensajes, notificaciones).
- `middleware/` — `auth.js` (`verifyToken`, `requireRole(...roles)`), `asyncHandler.js` (envuelve rutas async).
- `lib/` — utilidades sin dependencias de Express (`lan.js`, `notificar.js`).
- `db.js` — exporta el `pool` compartido de MySQL.
- `index.js` — configura la app, CORS, monta rutas bajo `/api/*` y el manejador central de errores (500 genérico).
- Routers por rol protegen todas sus rutas al inicio: `r.use(auth, requireRole("admin"))`; los routers compartidos (notas, asistencia, tareas, calendario, chatbot, mensajes, notificaciones) usan `verifyToken` + **verificación por endpoint**.
- Consultas con **sentencias preparadas** (`?` placeholders) y `pool.query(sql, [params])`.

**Frontend:**
- Ruta = archivo en `src/routes/`, con `createFileRoute("/path")({ beforeLoad, component })`.
- Protección de paneles **en dos capas**: `beforeLoad` con `requireRole("rol")` de `@/lib/guard` (navegación client-side) **y** `<AuthGate roles={[...]}>` en el layout (verifica sesión en la hidratación SSR, porque `beforeLoad` no re-corre en acceso directo por URL). Conservar ambas capas en rutas nuevas protegidas.
- Llamadas API siempre a través de `api<T>()` de `@/lib/api` (inyecta el token automáticamente).
- La sesión vive en `localStorage` o `sessionStorage` (según "recordarme") con claves `token` y `user`, gestionada por `api.ts` (`setSession`/`clearSession`/`getUser`).
- Componentes compartidos (`PanelShell`, `DataTable`, `StatCard`, `NotificationBell`, `ChatbotWidget`) encapsulan layout, tablas, métricas, notificaciones y chatbot.
- `DataTable` acepta props `loading`, `loadingMessage` y muestra empty states.
- UI 100% en **español**; toasts con `toast.success(...)` / `toast.error(...)` (sonner).

### Código limpio y legible
- Sin comentarios a menos que expliquen una decisión no obvia (p. ej. `lib/error-capture.ts`, `lib/lan.js`, fix de `decimalNumbers`).
- Errores con mensajes cortos y en español (`"Faltan datos"`, `"Credenciales inválidas"`, `"No autorizado"`, `"Prohibido"`).
- `console.error(err)` solo en el manejador de errores central; no dejar `console.log` de depuración en `frontend/src/` (los de backend son legítimos: arranque, migrate, seed).
- Formateo con **Prettier** (`npm run format`; `.prettierrc` con `endOfLine: "lf"`); ESLint en frontend con `no-unused-vars` como error y reglas de `react-hooks` y `react-refresh`.

---

## 6. Seguridad

- **JWT**: firmado con `JWT_SECRET` (fallback `"dev"` solo local), payload `{ id, rol, nombre, correo, foto_url }`, expira en 8h. Verificado con `verifyToken` en todas las rutas protegidas.
- **RBAC**: `requireRole(...roles)` devuelve 403 para roles no permitidos; además cada endpoint verifica la **pertenencia del recurso** (grupo del profesor, matrícula del estudiante, vínculo del acudiente) → 403 "No autorizado".
- **bcrypt**: contraseñas siempre con `bcrypt.hash(password, 10)`; comparación con `bcrypt.compare`. Nunca devolver ni loguear `password`.
- **SQL seguro**: parámetros preparados de mysql2 (`?`) en TODAS las consultas; jamás concatenar valores del usuario.
- **Errores opacos**: el manejador central devuelve `500 { error: "Error interno del servidor" }` sin detalles de MySQL; los 4xx conservan mensajes cortos.
- **CORS**: `lib/lan.js` permite `localhost` e IPs privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x) en el puerto del frontend; `CORS_ORIGIN` solo para casos extra.
- **Sesión en el cliente**: tokens en `localStorage`/`sessionStorage`; `AuthGate` + `requireRole` impiden acceso directo por URL sin sesión.

---

## 7. Instrucciones para Agentes de IA

### Cómo escribir o modificar código
1. **Lee el contexto antes de tocar nada**: revisa el router (ruta), el/los componente(s) compartidos y el endpoint correspondiente del backend antes de editar.
2. **Respeta los patrones existentes**:
   - Backend: agrega endpoints en el router del dominio correcto (rol propio o router compartido con verificación por endpoint). Usa `asyncHandler` para rutas async y `pool.query` con placeholders.
   - Frontend: nueva vista → nuevo archivo en `src/routes/`; lógica reutilizable → `src/lib/`; UI reutilizable → `src/components/`. Usa `api<T>()`, `cn()` y los componentes de `ui/`. Ruta protegida → `beforeLoad` + `AuthGate`.
3. **Sigue las convenciones de estilo** de la sección 5 (nombramiento, orden de imports, español en la UI, tipos con `type`).
4. **No mezcles estilos**: si una ruta usa `useState/useEffect`, no introduzcas otro patrón de manejo de estado en la misma ruta salvo que sea necesario y consistente.

### Mantener coherencia y no romper funcionalidad
- **No renombrar claves de sesión** (`token`, `user`) ni el formato de respuestas del backend: el frontend depende de `{ error }`, `{ ok: true }`, `{ id, nombre, correo, rol, foto_url }`, etc.
- **No cambiar la firma del JWT** ni el payload (`{ id, rol, nombre, correo, foto_url }`): `middleware/auth.js`, `lib/guard.ts` y `lib/api.ts` lo consumen.
- **No alterar el esquema de BD** sin actualizar `backend/migrations/001_init.sql` y el seed. Si agregas columnas/tablas, documenta la migración y respeta el orden de DROP (hijas primero).
- **CORS**: al agregar orígenes, recuerda que `lib/lan.js` ya permite localhost e IPs de red local; solo usa `CORS_ORIGIN` para casos extra.
- **Prueba de regresión mínima**: tras cambios, ejecuta `npm run lint` y `npm run build` (frontend). En backend, verifica que `npm run migrate` y `npm run seed` pasan y que el servidor arranca.
- **No rompas el login ni los guards**: cualquier cambio en auth debe conservar los cuatro roles (admin/profesor/estudiante/acudiente), el redireccionamiento por rol y la doble capa `beforeLoad` + `AuthGate`.

### Manejo de estados y validaciones
- **Estado del frontend**: sesión en `localStorage`/`sessionStorage` vía `api.ts` (`setSession`/`clearSession`/`getUser`). No dupliques la fuente de verdad del usuario; léela con `getUser()`.
- **Carga de datos**: usa `useState` + `useEffect` con `load()` reutilizable; recarga después de mutaciones (`await api(...); load();`). Muestra estados de carga (`loading` en `DataTable`) y empty states.
- **Manejo de errores**: enmarca llamadas API en `try/catch` y muestra `err.message` (usar `err instanceof Error ? err.message : "Error"`); muestra errores de formulario con clases `text-destructive`.
- **Validación backend (siempre)**: valida manualmente en cada endpoint — campos requeridos → `400 { error: "Faltan datos" }`; IDs inválidos → `400 "ID inválido"` (helper `parseId`); credenciales inválidas → `401`; sin autorización → `403`; recurso inexistente → `404`. Nunca confíes solo en la validación del frontend.
- **Sanitización**: usa parámetros preparados de `mysql2` (`?`) en TODAS las consultas; jamás concatenes valores del usuario en SQL.
- **Seguridad**: no loguees ni devuelvas `password`; nunca expongas `JWT_SECRET`; contraseñas siempre con `bcrypt.hash(..., 10)`.
- **Integridad de notas/asistencia**: verifica la pertenencia del recurso al profesor (`WHERE ... AND g.profesor_id = ?`) antes de escribir — conserva esa verificación.
- **Upserts**: para notas y asistencia usa `ON DUPLICATE KEY UPDATE` (claves únicas `uq_matricula`, `uq_asistencia`) en lugar de insertar duplicados.
- **Notificaciones**: usa `notificar(usuario_id, titulo, mensaje, tipo)` de `backend/lib/notificar.js` al publicar calificaciones, crear tareas o enviar mensajes.
- **Chatbot**: el Asistente SIA usa detección de intención por palabras clave (`detectarIntento`) + respuestas personalizadas por rol (`personalizar`); si agregas intenciones, mantenlas en `chatbot.js` y las guías en `guiasBasicas()`.

---

## 8. Comandos de Verificación

```bash
# Backend (requiere MySQL activo — XAMPP)
cd backend
npm run migrate        # esquema completo (destructivo: recrea las tablas)
npm run seed           # datos demo idempotentes
npm run dev            # servidor en http://localhost:3001

# Frontend
cd frontend
npm run lint           # ESLint: 0 errores esperados (warnings solo en components/ui/)
npm run build          # build de producción (TanStack Start + Nitro)
npm run dev            # servidor en http://localhost:8080
```

**Cuentas demo (seed):** `admin@sia.edu.co / admin123`, `profesor@sia.edu.co / prof123`, `estudiante@sia.edu.co / est123`, `acudiente@sia.edu.co / acu123`.

**QA manual opcional:** scripts Playwright en `C:\Users\geste\AppData\Local\Temp\opencode\pw\` (`test-guards.js` valida redirección de rutas protegidas; `test-all.js` valida login de los 4 roles sin errores de consola).
