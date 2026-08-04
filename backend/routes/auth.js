import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { verifyToken } from "../middleware/auth.js";

const r = Router();

r.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { correo, password } = req.body || {};
    if (!correo || !password) return res.status(400).json({ error: "Faltan datos" });
    const [rows] = await pool.query(
      "SELECT * FROM usuarios WHERE correo = ? AND estado = 'activo'",
      [correo],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Credenciales inválidas" });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });
    const token = jwt.sign(
      { id: u.id, rol: u.rol, nombre: u.nombre_completo, correo: u.correo, foto_url: u.foto_url },
      process.env.JWT_SECRET || "dev",
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
      },
    });
  }),
);

r.get(
  "/me",
  verifyToken,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, nombre_completo, correo, rol, foto_url, estado
       FROM usuarios WHERE id = ?`,
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
    });
  }),
);

export default r;
