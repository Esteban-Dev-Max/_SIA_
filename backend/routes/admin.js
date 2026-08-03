import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(auth, requireRole("admin"));

// ---------- Usuarios (estudiantes / profesores) ----------
r.get("/usuarios", async (req, res) => {
  const { rol } = req.query;
  const sql = rol
    ? "SELECT id, nombre, email, rol FROM usuarios WHERE rol = ? ORDER BY id DESC"
    : "SELECT id, nombre, email, rol FROM usuarios ORDER BY id DESC";
  const [rows] = await pool.query(sql, rol ? [rol] : []);
  res.json(rows);
});

r.post("/usuarios", async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: "Faltan datos" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [r2] = await pool.query(
      "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
      [nombre, email, hash, rol],
    );
    res.json({ id: r2.insertId, nombre, email, rol });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.put("/usuarios/:id", async (req, res) => {
  const { nombre, email, rol, password } = req.body;
  const fields = ["nombre = ?", "email = ?", "rol = ?"];
  const vals = [nombre, email, rol];
  if (password) {
    fields.push("password_hash = ?");
    vals.push(await bcrypt.hash(password, 10));
  }
  vals.push(req.params.id);
  await pool.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`, vals);
  res.json({ ok: true });
});

r.delete("/usuarios/:id", async (req, res) => {
  await pool.query("DELETE FROM usuarios WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ---------- Carreras ----------
r.get("/carreras", async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM carreras ORDER BY nombre");
  res.json(rows);
});
r.post("/carreras", async (req, res) => {
  const [r2] = await pool.query("INSERT INTO carreras (nombre) VALUES (?)", [req.body.nombre]);
  res.json({ id: r2.insertId, nombre: req.body.nombre });
});
r.put("/carreras/:id", async (req, res) => {
  await pool.query("UPDATE carreras SET nombre = ? WHERE id = ?", [req.body.nombre, req.params.id]);
  res.json({ ok: true });
});
r.delete("/carreras/:id", async (req, res) => {
  await pool.query("DELETE FROM carreras WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ---------- Materias ----------
r.get("/materias", async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT m.*, c.nombre AS carrera_nombre, u.nombre AS profesor_nombre
    FROM materias m
    LEFT JOIN carreras c ON c.id = m.carrera_id
    LEFT JOIN usuarios u ON u.id = m.profesor_id
    ORDER BY m.id DESC
  `);
  res.json(rows);
});
r.post("/materias", async (req, res) => {
  const { nombre, carrera_id, profesor_id } = req.body;
  const [r2] = await pool.query(
    "INSERT INTO materias (nombre, carrera_id, profesor_id) VALUES (?, ?, ?)",
    [nombre, carrera_id || null, profesor_id || null],
  );
  res.json({ id: r2.insertId });
});
r.put("/materias/:id", async (req, res) => {
  const { nombre, carrera_id, profesor_id } = req.body;
  await pool.query(
    "UPDATE materias SET nombre = ?, carrera_id = ?, profesor_id = ? WHERE id = ?",
    [nombre, carrera_id || null, profesor_id || null, req.params.id],
  );
  res.json({ ok: true });
});
r.delete("/materias/:id", async (req, res) => {
  await pool.query("DELETE FROM materias WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ---------- Matriculas ----------
r.get("/matriculas", async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT mat.*, u.nombre AS estudiante_nombre, m.nombre AS materia_nombre
    FROM matriculas mat
    JOIN usuarios u ON u.id = mat.estudiante_id
    JOIN materias m ON m.id = mat.materia_id
    ORDER BY mat.id DESC
  `);
  res.json(rows);
});
r.post("/matriculas", async (req, res) => {
  const { estudiante_id, materia_id, periodo } = req.body;
  try {
    const [r2] = await pool.query(
      "INSERT INTO matriculas (estudiante_id, materia_id, periodo) VALUES (?, ?, ?)",
      [estudiante_id, materia_id, periodo],
    );
    res.json({ id: r2.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
r.delete("/matriculas/:id", async (req, res) => {
  await pool.query("DELETE FROM matriculas WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

export default r;
