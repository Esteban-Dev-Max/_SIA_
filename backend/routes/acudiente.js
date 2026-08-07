import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken, requireRole("acudiente"));

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Estudiantes vinculados al acudiente.
r.get(
  "/estudiantes",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id AS estudiante_id, u.nombre_completo AS estudiante, u.correo
       FROM acudiente_estudiante ae
       JOIN usuarios u ON u.id = ae.estudiante_id
       WHERE ae.acudiente_id = ? AND u.estado = 'activo'
       ORDER BY u.nombre_completo`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

// Resumen académico de un estudiante a cargo: notas por materia y asistencia.
r.get(
  "/resumen/:estudiante_id",
  asyncHandler(async (req, res) => {
    const estudianteId = parseId(req.params.estudiante_id);
    if (!estudianteId) return res.status(400).json({ error: "ID inválido" });

    const [[vinc]] = await pool.query(
      `SELECT 1 FROM acudiente_estudiante
       WHERE acudiente_id = ? AND estudiante_id = ?`,
      [req.user.id, estudianteId],
    );
    if (!vinc) return res.status(403).json({ error: "Prohibido" });

    const [[est]] = await pool.query(
      `SELECT id, nombre_completo, correo, foto_url FROM usuarios
       WHERE id = ? AND rol = 'estudiante'`,
      [estudianteId],
    );
    if (!est) return res.status(404).json({ error: "Estudiante no encontrado" });

    const [notas] = await pool.query(
      `SELECT g.id AS grupo_id, g.periodo, g.horario,
              m.nombre AS materia, m.codigo AS materia_codigo,
              n.nota_1, n.nota_2, n.nota_3, n.examen_final, n.nota_definitiva,
              n.observaciones
       FROM matriculas ma
       JOIN grupos g ON g.id = ma.grupo_id
       JOIN materias m ON m.id = g.materia_id
       LEFT JOIN notas n ON n.matricula_id = ma.id
       WHERE ma.estudiante_id = ?
       ORDER BY g.periodo, m.nombre`,
      [estudianteId],
    );

    const [asistencia] = await pool.query(
      `SELECT a.fecha, a.estado, a.observacion, m.nombre AS materia
       FROM asistencia a
       JOIN matriculas ma ON ma.id = a.matricula_id
       JOIN grupos g ON g.id = ma.grupo_id
       JOIN materias m ON m.id = g.materia_id
       WHERE ma.estudiante_id = ?
       ORDER BY a.fecha DESC`,
      [estudianteId],
    );

    // La definitiva ya viene calculada con la ponderación única (lib/notas.js);
    // aquí solo se agrega el promedio. `n.nota_definitiva` es null mientras la
    // planilla del profesor esté incompleta.
    const conNota = notas.filter((n) => n.nota_definitiva != null);
    const promedio =
      conNota.length > 0
        ? conNota.reduce((acc, n) => acc + Number(n.nota_definitiva), 0) / conNota.length
        : null;

    res.json({
      estudiante: { id: est.id, nombre: est.nombre_completo, correo: est.correo, foto_url: est.foto_url },
      notas,
      asistencia,
      promedio: promedio != null ? Number(promedio.toFixed(2)) : null,
      materias_cursadas: notas.length,
    });
  }),
);

export default r;
