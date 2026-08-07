import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken, requireRole("profesor"));

// Grupos asignados al profesor (materia, periodo, horario y nº de alumnos).
r.get("/grupos", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT g.id, g.codigo_grupo, g.periodo, g.horario, m.nombre AS materia, m.codigo AS materia_codigo,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.grupo_id = g.id) AS alumnos
     FROM grupos g
     JOIN materias m ON m.id = g.materia_id
     WHERE g.profesor_id = ?
     ORDER BY m.nombre, g.codigo_grupo`,
    [req.user.id],
  );
  res.json(rows);
}));

export default r;
