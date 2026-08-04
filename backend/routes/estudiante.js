import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken, requireRole("estudiante"));

r.get("/notas", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT mat.id AS matricula_id, mat.periodo, m.nombre AS materia,
            n.parcial, n.medio, n.final,
            ROUND((COALESCE(n.parcial,0) + COALESCE(n.medio,0) + COALESCE(n.final,0)) / 3, 2) AS promedio
     FROM matriculas mat
     JOIN materias m ON m.id = mat.materia_id
     LEFT JOIN notas n ON n.matricula_id = mat.id
     WHERE mat.estudiante_id = ?
     ORDER BY mat.periodo DESC, m.nombre`,
    [req.user.id],
  );
  const promedioGeneral =
    rows.length > 0
      ? rows.reduce((s, x) => s + Number(x.promedio || 0), 0) / rows.length
      : 0;
  res.json({ materias: rows, promedio_general: Number(promedioGeneral.toFixed(2)) });
}));

r.get("/asistencia", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.fecha, a.presente, m.nombre AS materia
     FROM asistencia a
     JOIN matriculas mat ON mat.id = a.matricula_id
     JOIN materias m ON m.id = mat.materia_id
     WHERE mat.estudiante_id = ?
     ORDER BY a.fecha DESC`,
    [req.user.id],
  );
  res.json(rows);
}));

export default r;
