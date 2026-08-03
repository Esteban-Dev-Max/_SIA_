import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();

r.post(
  "/login",
  asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Faltan datos" });
  const [rows] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
  const u = rows[0];
  if (!u) return res.status(401).json({ error: "Credenciales inválidas" });
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });
  const token = jwt.sign(
    { id: u.id, rol: u.rol, nombre: u.nombre, email: u.email },
    process.env.JWT_SECRET || "dev",
    { expiresIn: "8h" },
  );
  res.json({ token, user: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } });
  }),
);

export default r;
