import { Router } from "express";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(auth, requireRole("profesor"));

// Materias asignadas al profesor
r.get("/materias", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM materias WHERE profesor_id = ? ORDER BY nombre",
    [req.user.id],
  );
  res.json(rows);
});

// Alumnos matriculados en una materia (con notas actuales)
r.get("/materias/:id/alumnos", async (req, res) => {
  const [[owns]] = await pool.query(
    "SELECT id FROM materias WHERE id = ? AND profesor_id = ?",
    [req.params.id, req.user.id],
  );
  if (!owns) return res.status(403).json({ error: "No autorizado" });
  const [rows] = await pool.query(
    `SELECT mat.id AS matricula_id, mat.periodo,
            u.id AS estudiante_id, u.nombre, u.email,
            n.parcial, n.medio, n.final
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN notas n ON n.matricula_id = mat.id
     WHERE mat.materia_id = ?
     ORDER BY u.nombre`,
    [req.params.id],
  );
  res.json(rows);
});

// Guardar/actualizar notas
r.put("/notas/:matricula_id", async (req, res) => {
  const { parcial, medio, final } = req.body;
  const [[m]] = await pool.query(
    `SELECT mat.id FROM matriculas mat
     JOIN materias mt ON mt.id = mat.materia_id
     WHERE mat.id = ? AND mt.profesor_id = ?`,
    [req.params.matricula_id, req.user.id],
  );
  if (!m) return res.status(403).json({ error: "No autorizado" });
  await pool.query(
    `INSERT INTO notas (matricula_id, parcial, medio, final)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE parcial = VALUES(parcial), medio = VALUES(medio), final = VALUES(final)`,
    [req.params.matricula_id, parcial ?? null, medio ?? null, final ?? null],
  );
  res.json({ ok: true });
});

// Registrar asistencia
r.post("/asistencia", async (req, res) => {
  const { matricula_id, fecha, presente } = req.body;
  const [[m]] = await pool.query(
    `SELECT mat.id FROM matriculas mat
     JOIN materias mt ON mt.id = mat.materia_id
     WHERE mat.id = ? AND mt.profesor_id = ?`,
    [matricula_id, req.user.id],
  );
  if (!m) return res.status(403).json({ error: "No autorizado" });
  await pool.query(
    `INSERT INTO asistencia (matricula_id, fecha, presente)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE presente = VALUES(presente)`,
    [matricula_id, fecha, presente ? 1 : 0],
  );
  res.json({ ok: true });
});

export default r;
