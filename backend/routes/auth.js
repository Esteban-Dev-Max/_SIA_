import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { verifyToken } from "../middleware/auth.js";
import {
  estaBloqueado,
  registrarFallo,
  limpiarBloqueo,
} from "../lib/rateLimit.js";

const r = Router();

r.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { correo, password } = req.body || {};
    if (
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !correo ||
      !password
    ) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const email = correo.trim().toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (estaBloqueado(email, ip)) {
      return res.status(429).json({
        error:
          "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
      });
    }

    const [rows] = await pool.query(
      `SELECT u.*, i.logo_url AS institucion_logo, i.estado AS institucion_estado, i.nombre AS institucion_nombre
       FROM usuarios u
       LEFT JOIN instituciones i ON i.id = u.institucion_id
       WHERE u.correo = ? AND u.estado = 'activo'`,
      [email],
    );
    const u = rows[0];
    const ok = u ? await bcrypt.compare(password, u.password) : false;
    if (!u || !ok) {
      registrarFallo(email, ip);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    limpiarBloqueo(email, ip);

    const token = jwt.sign(
      {
        id: u.id,
        rol: u.rol,
        nombre: u.nombre_completo,
        correo: u.correo,
        foto_url: u.foto_url,
        institucion_id: u.institucion_id,
        institucion_logo: u.institucion_logo,
        institucion_estado: u.institucion_estado,
        institucion_nombre: u.institucion_nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );
    res.json({
      token,
      user: {
        id: u.id,
        nombre: u.nombre_completo,
        correo: u.correo,
        rol: u.rol,
        foto_url: u.foto_url,
        institucion_id: u.institucion_id,
        institucion_logo: u.institucion_logo,
        institucion_estado: u.institucion_estado,
        institucion_nombre: u.institucion_nombre,
      },
    });
  }),
);

r.get(
  "/me",
  verifyToken,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre_completo, u.correo, u.rol, u.foto_url, u.estado, i.logo_url AS institucion_logo, i.estado AS institucion_estado, i.nombre AS institucion_nombre
       FROM usuarios u
       LEFT JOIN instituciones i ON i.id = u.institucion_id
       WHERE u.id = ?`,
      [req.user.id],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "No autorizado" });
    res.json({
      id: u.id,
      nombre: u.nombre_completo,
      correo: u.correo,
      rol: u.rol,
      foto_url: u.foto_url,
      institucion_logo: u.institucion_logo,
      institucion_estado: u.institucion_estado,
      institucion_nombre: u.institucion_nombre,
    });
  }),
);

r.post(
  "/cambiar-password",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { password_actual, password_nueva } = req.body || {};
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (String(password_nueva).length < 6) {
      return res
        .status(400)
        .json({
          error: "La nueva contraseña debe tener al menos 6 caracteres",
        });
    }

    const [[u]] = await pool.query(
      "SELECT id, `password` FROM usuarios WHERE id = ?",
      [req.user.id],
    );
    if (!u) return res.status(401).json({ error: "No autorizado" });

    const ok = await bcrypt.compare(password_actual, u.password);
    if (!ok)
      return res
        .status(400)
        .json({ error: "La contraseña actual no es correcta" });

    const repetida = await bcrypt.compare(password_nueva, u.password);
    if (repetida) {
      return res
        .status(400)
        .json({ error: "La nueva contraseña no puede ser igual a la actual" });
    }

    const hash = await bcrypt.hash(password_nueva, 10);
    await pool.query("UPDATE usuarios SET `password` = ? WHERE id = ?", [
      hash,
      u.id,
    ]);
    res.json({ ok: true });
  }),
);

export default r;
