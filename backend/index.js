import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import profesorRoutes from "./routes/profesor.js";
import estudianteRoutes from "./routes/estudiante.js";
import acudienteRoutes from "./routes/acudiente.js";
import notasRoutes from "./routes/notas.js";
import asistenciaRoutes from "./routes/asistencia.js";
import tareasRoutes from "./routes/tareas.js";
import calendarioRoutes from "./routes/calendario.js";
import chatbotRoutes from "./routes/chatbot.js";
import mensajesRoutes from "./routes/mensajes.js";
import notificacionesRoutes from "./routes/notificaciones.js";
import { isLanOrigin } from "./lib/lan.js";
import { pool } from "./db.js";

dotenv.config();

const app = express();

const FRONTEND_PORT = process.env.FRONTEND_PORT || "8080";
const extraOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (extraOrigins.includes(origin)) return callback(null, true);
      if (isLanOrigin(origin, FRONTEND_PORT)) return callback(null, true);
      callback(new Error(`CORS bloqueado para origen: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profesor", profesorRoutes);
app.use("/api/estudiante", estudianteRoutes);
app.use("/api/acudiente", acudienteRoutes);
app.use("/api/notas", notasRoutes);
app.use("/api/asistencia", asistenciaRoutes);
app.use("/api/tareas", tareasRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/mensajes", mensajesRoutes);
app.use("/api/notificaciones", notificacionesRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  const mensaje =
    status === 500 ? "Error interno del servidor" : err.message || "Error en la solicitud";
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
