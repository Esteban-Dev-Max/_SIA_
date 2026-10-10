import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken, requireRole("profesor"));

// Asignaciones del docente (asignatura, periodo, horario y nº de alumnos).
// Se conserva el contrato externo (ruta y campos materia/codigo_grupo, donde
// codigo_grupo ahora es el curso, ej. "Sexto A"); por dentro se lee de
// asignaciones/cursos/grados.
r.get("/grupos", asyncHandler(async (req, res) => {
  const params = [req.user.id];
  let filterInst = "";
  if (req.user.institucion_id) {
    filterInst = " AND a.institucion_id = ?";
    params.push(req.user.institucion_id);
  }
  const [rows] = await pool.query(
    `SELECT a.id, a.periodo, a.horario, s.nombre AS materia, s.codigo AS materia_codigo,
            CONCAT(g.nombre, ' ', c.nombre) AS codigo_grupo, c.ano_lectivo,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.asignacion_id = a.id) AS alumnos
     FROM asignaciones a
     JOIN cursos c ON c.id = a.curso_id
     JOIN grados g ON g.id = c.grado_id
     JOIN asignaturas s ON s.id = a.asignatura_id
     WHERE a.docente_id = ?${filterInst}
     ORDER BY s.nombre, c.nombre`,
    params,
  );
  res.json(rows);
}));

export default r;
