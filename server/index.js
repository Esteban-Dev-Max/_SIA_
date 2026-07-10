import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import profesorRoutes from "./routes/profesor.js";
import estudianteRoutes from "./routes/estudiante.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://192.168.0.164:8080",
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqueado para origen: ${origin}`));
      }
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = 3001;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`API escuchando en http://localhost:${PORT} y en la red local (puerto ${PORT})`);
});
