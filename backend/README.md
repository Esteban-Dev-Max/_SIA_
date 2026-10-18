# Backend Académico (Express + MySQL)

API REST de **SIA** — Node.js/Express con MySQL local (ESM). Servido por PM2 como `sia-backend` en producción.

## Acceso desde el celular (misma red)

Para que el profe use la app desde su celular mientras tú la corres en la PC:

1. PC y celular en la **misma red**: WiFi del SENA, hotspot del celular (PC conectada al hotspot), o hotspot de la PC.
2. Levanta backend y frontend como siempre (dos terminales).
3. Al arrancar el backend verás URLs tipo `http://192.168.x.x:8080` — **esa es la que abre el profe en el navegador del celular**.
4. En Vite también aparece la línea `Network: http://192.168.x.x:8080/` al hacer `npm run dev`.

**Firewall (Windows, una sola vez):** si el celular no carga la página, ejecuta PowerShell como administrador:

```powershell
netsh advfirewall firewall add rule name="Academico Frontend" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="Academico API" dir=in action=allow protocol=TCP localport=3001
```

**Importante:** esto funciona en la red local (WiFi/hotspot). No expone la app a internet público.

## Requisitos
- Node.js 20+
- MySQL 8+ corriendo en `localhost:3306`

## Instalación
```bash
cd backend
cp .env.example .env      # edita credenciales de tu MySQL y el JWT_SECRET
npm install
npm run migrate           # crea la BD `academico` y las tablas (destructivo)
npm run seed              # crea usuarios demo (idempotente)
npm run dev               # arranca en http://localhost:3001 (node --watch)
```

- `npm run start` — `node index.js`, lo que corre PM2 en producción.
- `index.js` aborta al arrancar solo si **falta** `JWT_SECRET`; no valida el placeholder de `.env.example` — cámbialo.

## Usuarios demo
> ⚠️ **Solo para desarrollo local.** En producción se rotan estas contraseñas; no quedan con los valores del seed.

| Rol         | Email                   | Password (dev) |
|-------------|-------------------------|-----------|
| admin       | admin@sia.edu.co        | admin123  |
| profesor    | profesor@sia.edu.co     | prof123   |
| estudiante  | estudiante@sia.edu.co   | est123    |
| acudiente   | acudiente@sia.edu.co    | acu123    |

## Variables de entorno (`.env`)
| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend (3001) |
| `FRONTEND_PORT` | Puerto del frontend (8080) — usado por CORS |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión MySQL (BD `academico`) |
| `JWT_SECRET` | Clave de firma de tokens (sesión de 8 h). No dejes el placeholder |
| `GEMINI_API_KEY` | Opcional. Key de Google AI Studio (https://aistudio.google.com/apikey). Sin key, el asistente responde con el motor por palabras clave |
| `GEMINI_MODEL` | Modelo Gemini (por defecto `gemini-3.5-flash`). Si no existe (404) o hay cuota (429), fallback silencioso al motor por palabras clave |
| `CORS_ORIGIN` | Orígenes extra separados por coma (localhost e IPs privadas ya se permiten) |

## Endpoints
Todos los endpoints (excepto `/api/auth/*` y `/health`) requieren `Authorization: Bearer <token>` y revalidan el estado del usuario contra la BD en cada petición.

- `POST /api/auth/login` — inicio de sesión (devuelve JWT)
- `/api/admin/*` — usuarios, grados, asignaturas, cursos, asignaciones, matrículas anuales, acudientes y estadísticas
- `/api/profesor/*` — `GET /grupos` (clases asignadas al docente)
- `/api/notas/*` — registro y consulta de notas por matrícula (docente, estudiante, acudiente)
- `/api/asistencia/*` — `POST /registrar`, `GET /grupo/:grupo_id`, excusas (`/excusa`, `/excusa/descargar`), `GET /resumen/estudiante/:estudiante_id`
- `/api/acudiente/*` — resumen académico de los estudiantes vinculados
- `/api/tareas/*` — tareas y entregas por clase/estudiante
- `/api/calendario/*` — eventos y tareas con fecha
- `/api/chatbot/*` — `POST /pregunta` (asistente por intención / palabras clave)
- `/api/chat` — `POST` asistente con IA Gemini (cae a `lib/chatbotEngine.js` si falla)
- `/api/mensajes/*` — conversaciones internas (`/contactos`, `/conversacion/:usuario_id/:contacto_id`, `/enviar`, `/leidas/...`)
- `/api/notificaciones/*` — alertas por usuario (`GET /:usuario_id`, `PUT /marcar-leida/:id`, `PUT /marcar-todas/:usuario_id`)
- `GET /health` — estado del servidor y conexión a MySQL

## Documentación
- `README.md` (raíz) — instalación completa, orden de arranque y cuentas demo.
- `AGENTS.md` (raíz) — convenciones de código, seguridad y despliegue PM2 + túneles.
