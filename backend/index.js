import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import profesorRoutes from "./routes/profesor.js";
import acudienteRoutes from "./routes/acudiente.js";
import notasRoutes from "./routes/notas.js";
import asistenciaRoutes from "./routes/asistencia.js";
import tareasRoutes from "./routes/tareas.js";
import calendarioRoutes from "./routes/calendario.js";
import chatbotRoutes from "./routes/chatbot.js";
import chatRoutes from "./routes/chat.js";
import mensajesRoutes from "./routes/mensajes.js";
import notificacionesRoutes from "./routes/notificaciones.js";
import institucionesRoutes from "./routes/instituciones.js";
import { isLanOrigin } from "./lib/lan.js";
import { pool } from "./db.js";

dotenv.config();

// Fail-fast: sin JWT_SECRET el backend no debe arrancar, porque los tokens se
// firmarían con un secreto conocido (compromiso total de las sesiones).
if (!process.env.JWT_SECRET) {
  console.error(
    "Falta la variable JWT_SECRET. Crea backend/.env a partir de .env.example con una clave larga y aleatoria.",
  );
  process.exit(1);
}

const app = express();

const FRONTEND_PORT = process.env.FRONTEND_PORT || "8080";
const extraOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Orígenes derivados del Host de cada petición: cuando la UI y la API se sirven
// por la misma URL pública (p. ej. Tailscale Funnel: `/` para la UI y `/api`
// para la API), el navegador manda el header `Origin` en los POST aunque sean
// misma-origen, y ese origen no es ni localhost ni una IP privada. Aquí se
// permite cualquier origen cuyo host coincida con el Host de la petición (la
// propia URL pública), sin necesidad de hardcodear el dominio.
const dynamicOrigins = new Set();

app.use((req, _res, next) => {
  const host = req.headers.host;
  if (host && typeof host === "string") {
    dynamicOrigins.add(`https://${host}`);
    dynamicOrigins.add(`http://${host}`);
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (extraOrigins.includes(origin) || dynamicOrigins.has(origin))
        return callback(null, true);
      if (isLanOrigin(origin, FRONTEND_PORT)) return callback(null, true);
      const e = new Error(`CORS bloqueado para origen: ${origin}`);
      e.status = 403;
      callback(e);
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
// Alias bajo /api/*: cuando se publica por un túnel con enrutado de path /api -> backend,
// el health check debe estar accesible también ahí.
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Avatares públicos (solo esa carpeta): uploads/excusas contiene documentos de
// estudiantes y se sirve únicamente por su endpoint autenticado. Se monta en
// /uploads/avatars (acceso directo en dev) y en /api/uploads/avatars porque es
// la ruta que atraviesa el túnel de publicación (/api -> backend).
const CARPETA_AVATARES = path.join(process.cwd(), "uploads", "avatars");
app.use("/uploads/avatars", express.static(CARPETA_AVATARES));
app.use("/api/uploads/avatars", express.static(CARPETA_AVATARES));

// Logos de instituciones (branding multi-tenant)
const CARPETA_LOGOS = path.join(process.cwd(), "uploads", "logos");
app.use("/uploads/logos", express.static(CARPETA_LOGOS));
app.use("/api/uploads/logos", express.static(CARPETA_LOGOS));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profesor", profesorRoutes);
app.use("/api/acudiente", acudienteRoutes);
app.use("/api/notas", notasRoutes);
app.use("/api/asistencia", asistenciaRoutes);
app.use("/api/tareas", tareasRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/mensajes", mensajesRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/instituciones", institucionesRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  // Cuerpo JSON mal formado o demasiado grande: se responde en español antes
  // de caer en el 500 genérico.
  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ error: "Solicitud inválida: el cuerpo no es JSON válido" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "La solicitud es demasiado grande" });
  }
  // Violaciones de clave foránea: un dato referenciado no existe. Antes de esta
  // validación terminaban como 500 "Error interno" cuando faltaba el chequeo previo.
  if (
    err.code === "ER_NO_REFERENCED_ROW" ||
    err.code === "ER_NO_REFERENCED_ROW_2"
  ) {
    return res.status(400).json({
      error:
        "Uno de los datos referenciados no existe. Verifica e inténtalo de nuevo.",
    });
  }
  if (err.code === "ER_DUP_ENTRY") {
    return res
      .status(400)
      .json({ error: "Ya existe un registro con esos datos." });
  }
  const status =
    err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  const mensaje =
    status === 500
      ? "Error interno del servidor"
      : err.message || "Error en la solicitud";
  res.status(status).json({ error: mensaje });
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await pool.query("SELECT 1");
    console.log("MySQL conectado correctamente");
  } catch (err) {
    console.error(
      "No se pudo conectar a MySQL. Inicia MySQL en XAMPP y reinicia el backend.",
    );
    console.error(err.message);
  }
});
