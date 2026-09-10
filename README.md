# 📚 SIA — Sistema Integral Académico

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat&logo=mysql&logoColor=white)](https://www.mysql.com)
[![TanStack](https://img.shields.io/badge/TanStack_Start-Router%20%2F%20Query-FF4154?style=flat&logo=tanstack&logoColor=white)](https://tanstack.com)

> Plataforma web full-stack para instituciones educativas: centraliza la gestión de **estudiantes, profesores, carreras, materias, matrículas, notas, asistencia, tareas, comunicaciones** e **instituciones** en una sola aplicación, con paneles dedicados por rol (incluido **Super Admin**) y accesible desde cualquier dispositivo de la red local o vía Tailscale Funnel.

---

## 📌 Descripción General

**SIA** es un sistema cliente-servidor pensado para colegios, institutos y universidades pequeñas. Reemplaza las planillas en papel y las hojas de cálculo dispersas por una experiencia web moderna, con modelo **multi-tenant (SaaS)**: cada institución tiene sus datos aislados, su branding y su propio administrador, gestionados por un rol de **Super Admin**:

- **Cinco paneles especializados** según el rol del usuario: Super Admin, Administrador, Profesor, Estudiante y Acudiente.
- **Multi-tenant**: cada institución opera con sus propios datos (estudiantes, materias, notas, etc.) sin mezclarlos; el Super Admin crea/activa/desactiva instituciones y sube su logo.
- **Evaluación con ponderación automática** (25% + 25% + 20% + 30%) y **promedios calculados en tiempo real**.
- **Comunicación integrada**: mensajería interna, notificaciones y un **chatbot asistente** que responde preguntas académicas frecuentes con datos reales del usuario.
- **Corre en red local**: con XAMPP + MySQL y dos terminales, la aplicación es accesible desde el celular en la misma red WiFi.

```
┌─────────────┐   HTTP (JWT Bearer)   ┌─────────────┐    MySQL
│  Frontend   │ ────────────────────▶ │  Backend    │ ─────────▶
│  React 19   │   http://<host>:3001  │  Express    │    academico
│  puerto 8080│ ◀──────────────────── │  puerto 3001│
└─────────────┘                       └─────────────┘
```

---

## 🚀 Funcionalidades Principales

### 👑 Super Admin — `/admin/instituciones`
- **Instituciones**: CRUD completo de instituciones educativas (nombre, contacto, departamento/ciudad) con estado activo/inactivo y **logo propio** (PNG/JPG/SVG/WEBP).
- **Alta por institución**: crea la institución y en la misma operación el administrador inicial para que arranque a trabajar solo.
- **Control de acceso**: desactivar o reactivar una institución invalida las sesiones de sus usuarios y **notifica automáticamente** a sus administradores.
- La **carga masiva de usuarios** también está disponible para el superadmin cuando tiene institución asociada.

### 👨‍💼 Administrador — `/admin`
- **Usuarios**: CRUD completo (crear, listar, buscar, editar, activar/inactivar) con los 4 roles de la institución, **foto de perfil** y **carga masiva desde CSV/XLSX** (columnas `nombre, correo, rol, password`; roles profesor/estudiante/acudiente; hasta 2000 filas con validación por fila y reporte de errores).
- **Gestión académica**: CRUD de carreras/grados y materias (con créditos y asociación a carrera).
- **Grupos**: creación de grupos por materia, profesor y periodo; asignación de horarios.
- **Matrículas**: inscripción de estudiantes en grupos y eliminación de matrículas.
- **Acudientes**: vinculación de acudientes con estudiantes a cargo.
- **Panel de estadísticas**: métricas generales de la institución.
- Permite además **registrar notas** (mismo flujo del profesor) y gestionar **eventos del calendario**.

### 👨‍🏫 Profesor — `/profesor`
- **Planilla de calificaciones**: registro de notas por grupo con **cálculo automático de la definitiva** según la ponderación: nota 1 (25%) + nota 2 (25%) + nota 3 (20%) + examen final (30%). Se aprueba con 3.0 o más.
- **Toma de asistencia diaria**: marca *presente / ausente / tarde / excusa* por grupo y fecha, con observaciones y **soporte adjunto de la excusa** (PDF/JPG/PNG descargable por el docente).
- **Resumen de asistencia**: porcentajes, fallas y conteos por materia y por estudiante con fecha.
- **Tareas**: creación de tareas por grupo (título, descripción, fecha de entrega y puntaje máximo), revisión de entregas de cada estudiante y **calificación con retroalimentación**.
- Cada acción relevante genera una **notificación automática** al estudiante.

### 🎓 Estudiante — `/estudiante`
- **Notas en tiempo real**: calificaciones por materia (nota 1, 2, 3 y examen) con definitiva y **promedio general**.
- **Historial de asistencia**: porcentaje total, fallas acumuladas y detalle por materia.
- **Tareas**: listado con fechas de vencimiento y **entrega** (enlace del archivo + comentario).
- **Calendario unificado**: tareas con fecha límite y eventos institucionales (evaluaciones, reuniones, entregas) en vista mensual y semanal.
- **Asistente SIA (chatbot)**: responde en lenguaje natural sobre notas, promedio, tareas, asistencia, reuniones y más, usando los datos reales del estudiante.
- **Notificaciones**: campana con alertas de calificaciones publicadas, tareas por vencer y mensajes.

### 🧑‍🤝‍🧑 Acudiente — `/acudiente`
- **Monitoreo de rendimiento**: resumen académico de cada estudiante vinculado — notas ponderadas por materia, promedio y materias cursadas.
- **Alertas de inasistencia**: conteo de ausencias y detalle del historial de asistencia.
- **Boletín imprimible**: descarga/impresión del boletín del estudiante en PDF (vía impresión del navegador).

### 🔄 Módulos Transversales
- **Autenticación JWT**: login con token de 8 horas, sesión persistente (`localStorage`) u opcional (`sessionStorage`), **RBAC** (control de acceso por rol) en cada endpoint y bloqueo por fuerza bruta en el inicio de sesión. Recuperación de contraseña por correo (`/forgot-password` y `/reset-password`, público) para todos los roles.
- **Configuración por usuario** (`/configuracion`): perfil con foto de avatar, apariencia (tema claro/oscuro) y seguridad (cambio de contraseña).
- **Mensajería interna**: chat entre administradores, profesores, estudiantes y acudientes, con indicadores de leídos.
- **Notificaciones en tiempo real**: alertas de *sistema, nota, tarea, mensaje y evento* con actualización periódica (polling cada 60 s) en la campana de la cabecera.

---

## 🛠️ Stack Tecnológico

### Frontend (`frontend/`)
| Tecnología | Uso |
|---|---|
| **React 19** + **TypeScript 5** (estricto) | UI y tipado |
| **Vite 8** + **lightningcss** | Build y transformación de CSS |
| **TanStack Start** / **Router** / **Query** | Framework full-stack SSR, enrutado por archivos y estado de datos |
| **Tailwind CSS 4** | Estilos utilitarios |
| **shadcn/ui** sobre **Radix UI** | Componentes accesibles (`src/components/ui/`) |
| **lucide-react**, **sonner**, **date-fns** | Iconos, toasts y fechas |
| **recharts**, **zod**, **react-hook-form** | Gráficas y validación (disponibles) |

### Backend (`backend/`)
| Tecnología | Uso |
|---|---|
| **Node.js 20+** (ESM) + **Express 4** | API REST |
| **mysql2/promise** | Pool de conexiones con sentencias preparadas |
| **jsonwebtoken** | JWT (`expiresIn: "8h"`) |
| **bcryptjs** | Hash de contraseñas (10 rondas) |
| **cors + dotenv** | Orígenes permitidos (red local + dinámicos por Host) y configuración |
| **multer** | Subida de avatares, logos de institución y soportes de excusa |
| **xlsx** | Carga masiva de usuarios desde CSV/XLSX |

### Pruebas
| Tecnología | Uso |
|---|---|
| **node --test** + **Supertest** | Unit e integración del backend (BD `academico_test`) |
| **Vitest** + **Testing Library** | Tests del frontend (`npm test`) |
| **Playwright** | Tests E2E en `e2e/` (`npm run test:e2e`) |

### Base de datos
**MySQL 8** — base de datos `academico` con 14 tablas relacionales (mapeo completo en [AGENTS.md](AGENTS.md)).

---

## 📁 Estructura del Proyecto

```
SIA/
├── backend/                     # API REST (puerto 3001)
│   ├── index.js                 # Entrada: arranca el listener y chequea MySQL
│   ├── app.js                   # App Express: CORS, estáticos (uploads/), rutas y errores
│   ├── db.js                    # Pool de MySQL (decimalNumbers: true)
│   ├── migrate.js               # Ejecuta migrations/001-005 en orden
│   ├── seed.js                  # Datos demo (idempotente)
│   ├── .env.example             # Plantilla de variables de entorno
│   ├── migrations/              # 001_init.sql, 002_multi_tenant.sql,
│   │                            # 003_institucion_logo.sql, 004_password_reset.sql,
│   │                            # 005_tareas_columna_nota.sql
│   ├── routes/                  # auth (incluye recuperación de contraseña),
│   │                            # admin, profesor, acudiente, notas, asistencia,
│   │                            # tareas, calendario, chatbot, mensajes, notificaciones,
│   │                            # instituciones, usuarios
│   ├── middleware/              # verifyToken, requireRole, asyncHandler
│   ├── lib/                     # notas, notasTareas, horario, rateLimit, lan, notificar, mailer, chatbotEngine
│   ├── uploads/                 # avatares/, logos/, excusas/ (archivos subidos)
│   └── tests/                   # unit/ e integration/ (node --test + Supertest)
│
├── frontend/                    # UI React (puerto 8080)
│   ├── vite.config.ts           # Alias @/, SSR, puerto 0.0.0.0:8080
│   ├── .env                     # VITE_API_URL (solo SSR, versionado)
│   └── src/
│       ├── routes/              # Rutas por archivo (kebab-case)
│       │   ├── index.tsx        # Landing pública
│       │   ├── login.tsx
│       │   ├── admin/           # Panel, usuarios, instituciones, académico
│       │   ├── profesor/        # Panel (notas+asistencia+resumen), tareas
│       │   ├── estudiante/      # Panel (notas+asistencia), tareas
│       │   ├── acudiente/       # Panel (boletín)
│       │   ├── mensajes.tsx, calendario.tsx, configuracion.tsx
│       ├── components/          # PanelShell, DataTable, StatCard, AuthGate,
│       │   │                    # ChatbotWidget, NotificationBell, AsistenciaTab,
│       │   │                    # HistorialAsistenciaTab, InstitucionModal
│       │   └── ui/              # shadcn/ui (Radix)
│       └── lib/                 # api.ts (fetch+JWT), guard.ts (RBAC), utils
│
└── e2e/                         # Tests Playwright (auth, superadmin)
```

---

## ⚙️ Guía de Instalación y Ejecución Local

### 1. Requisitos previos
- **Node.js 20.19+** (recomendado: 22 LTS) — incluye `npm`.
- **MySQL 8** — el modo más simple es **XAMPP** (Apache + MySQL) o MySQL instalado por separado.

### 2. Configuración de variables de entorno

**Backend** — crea el archivo `.env` a partir de la plantilla:

```bash
cd backend
cp .env.example .env
```

```env
PORT=3001
FRONTEND_PORT=8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=academico
JWT_SECRET=cambia_esto_por_una_cadena_larga_y_aleatoria
# Recuperación de contraseña (SMTP). Sin SMTP, forgot-password imprime el
# enlace en la consola en lugar de enviar el correo (suficiente para probar en dev).
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM="SIA <soporte@miapp.edu.co>"
FRONTEND_URL=http://localhost:8080
```

> 💡 **CORS en red local**: el backend permite automáticamente orígenes de `localhost` e IPs privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x) en el puerto del frontend. Solo agrega `CORS_ORIGIN` (separado por comas) para casos especiales.

**Frontend** (opcional — se autoconfigura):

No hay `.env.example` para el frontend: `frontend/.env` (versionado) solo define `VITE_API_URL` para las llamadas **SSR** (usa `http://localhost:3001` en el servidor). En el navegador, `api()` resuelve según el protocolo: sobre **HTTPS** (publicación vía Tailscale Funnel) usa paths relativos `/api/*` (misma-origen, sin CORS); sobre **HTTP** (localhost o IP LAN) usa `window.location.hostname:3001`, así funciona desde otros dispositivos de la red sin configurar nada.

### 3. Instalación de dependencias

```bash
# Terminal 1 — Backend
cd backend
npm install

# Terminal 2 — Frontend
cd frontend
npm install
```

### 4. Crear la base de datos y los datos iniciales

> Asegúrate de que MySQL esté activo (XAMPP → Start MySQL).

```bash
cd backend
npm run migrate   # Aplica 001 (esquema base) + 002 (multi-tenant/superadmin) + 003 (logos) + 004 (recuperación de contraseña) + 005 (sincronización tareas→notas)
npm run seed      # Inserta institución, usuarios demo, materias, grupos, notas, etc.
```

### 5. Iniciar los servidores

```bash
# Terminal 1 — Backend (puerto 3001)
cd backend
npm run dev       # node --watch: se reinicia solo al editar

# Terminal 2 — Frontend (puerto 8080)
cd frontend
npm run dev
```

Abre **http://localhost:8080** y haz login con cualquiera de las cuentas demo.

### ✅ Orden de arranque (resumen)

1. XAMPP → **Start MySQL**.
2. Terminal backend → `npm run dev`.
3. Terminal frontend → `npm run dev`.
4. Ingresar a `http://localhost:8080`.

### 📱 Acceso desde el celular (misma red)

1. Encuentra la IP local de la máquina (`ipconfig` → IPv4, ej. `192.168.0.164`).
2. Abre desde el celular: `http://192.168.0.164:8080`.
3. El frontend y el backend se comunican automáticamente por la misma IP (CORS ya lo permite).

### 🌐 Acceso público (Tailscale Funnel)

En el servidor de producción, SIA se publica con **Tailscale Funnel** en una URL estable `https://sia.<tailnet>.ts.net` (sin dominio, HTTPS automático, funciona tras NAT/firewall). El túnel enruta `/` → frontend (8080) y `/api` → backend (3001/api). Se gestiona con `sudo tailscale funnel ...` y persiste entre reinicios. En el navegador sobre HTTPS, `api()` usa paths relativos `/api/*` (misma-origen, sin CORS); en SSR llama a `http://localhost:3001` directo.

---

## 🔑 Cuentas Demo de Prueba

> ⚠️ **Solo para desarrollo local.** En un despliegue público las contraseñas por defecto del seed deben **rotarse** (no quedan con estos valores). La URL pública (`https://sia.<tailnet>.ts.net`) usa cuentas con contraseñas aleatorias que no están en este documento.

| Rol | Email | Contraseña (dev) | Panel |
|---|---|---|---|
| 👑 Super Admin | `superadmin@sia.edu.co` | `superadmin123` | `/admin/instituciones` |
| 👨‍💼 Administrador | `admin@sia.edu.co` | `admin123` | `/admin` |
| 👨‍🏫 Profesor | `profesor@sia.edu.co` | `prof123` | `/profesor` |
| 🎓 Estudiante | `estudiante@sia.edu.co` | `est123` | `/estudiante` |
| 🧑‍🤝‍🧑 Acudiente | `acudiente@sia.edu.co` | `acu123` | `/acudiente` |

El seed incluye datos de ejemplo: 5 cuentas demo (incluye superadmin, sin institución), 1 institución, 2 carreras, 3 materias, 3 grupos (periodo 2026-1), 2 matrículas con notas y asistencia, 1 tarea con entrega calificada, evento de calendario, mensajes y notificaciones.

---

## 🧪 Verificación rápida (QA)

```bash
# Backend (requiere MySQL activo)
cd backend && npm run migrate && npm run seed   # esquema (001-005) + datos demo

# Frontend
cd frontend
npm run lint        # ESLint: 0 errores esperados
npm run build       # Build de producción (TanStack Start + Nitro)

# Pruebas (desde la raíz del repo)
npm test                    # unit del backend (node --test) + Vitest del frontend
npm run test:setup:db       # crea y siembra la BD academico_test
npm run test:integration    # integración del backend (Supertest) + frontend
npm run test:e2e            # E2E con Playwright (e2e/)
```

---

## 📄 Documentación técnica

La guía interna para desarrolladores y agentes de IA — **mapeo completo de la API**, esquema relacional de la base de datos, convenciones de código y reglas de seguridad — está en **[AGENTS.md](AGENTS.md)**.

---

Licencia: uso interno / educativo. Proyecto **SIA — Sistema Integral Académico**.
