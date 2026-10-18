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
    const params = [req.user.id];
    let filterInst = "";
    if (req.user.institucion_id) {
      filterInst = " AND u.institucion_id = ?";
      params.push(req.user.institucion_id);
    }
    const [rows] = await pool.query(
      `SELECT u.id AS estudiante_id, u.nombre_completo AS estudiante, u.correo
       FROM acudiente_estudiante ae
       JOIN usuarios u ON u.id = ae.estudiante_id
       WHERE ae.acudiente_id = ? AND u.estado = 'activo'${filterInst}
       ORDER BY u.nombre_completo`,
      params,
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
      `SELECT a.id AS grupo_id, a.periodo, a.horario,
              s.nombre AS materia, s.codigo AS materia_codigo,
              d.nombre_completo AS profesor,
              n.nota_1, n.nota_2, n.nota_3, n.examen_final, n.nota_definitiva,
              n.observaciones
       FROM matriculas ma
       JOIN asignaciones a ON a.id = ma.asignacion_id
       JOIN asignaturas s ON s.id = a.asignatura_id
       LEFT JOIN usuarios d ON d.id = a.docente_id
       LEFT JOIN notas n ON n.matricula_id = ma.id
       WHERE ma.estudiante_id = ?
       ORDER BY a.periodo, s.nombre`,
      [estudianteId],
    );

    const [asistencia] = await pool.query(
      `SELECT a.fecha, a.estado, a.observacion, s.nombre AS materia, g.periodo
       FROM asistencia a
       JOIN matriculas ma ON ma.id = a.matricula_id
       JOIN asignaciones g ON g.id = ma.asignacion_id
       JOIN asignaturas s ON s.id = g.asignatura_id
       WHERE ma.estudiante_id = ?
       ORDER BY a.fecha DESC`,
      [estudianteId],
    );

    // Curso anual del estudiante (grado + letra) y su director de grupo.
    const [[curso]] = await pool.query(
      `SELECT c.nombre AS nombre, g.nombre AS grado, c.ano_lectivo AS ano_lectivo,
              d.nombre_completo AS director
       FROM matriculas_curso mc
       JOIN cursos c ON c.id = mc.curso_id
       JOIN grados g ON g.id = c.grado_id
       LEFT JOIN usuarios d ON d.id = c.director_id
       WHERE mc.estudiante_id = ?
       ORDER BY c.ano_lectivo DESC
       LIMIT 1`,
      [estudianteId],
    );

    // Datos institucionales para el encabezado del boletín.
    let institucion = null;
    if (req.user.institucion_id) {
      const [[inst]] = await pool.query(
        `SELECT nombre, correo, telefono, departamento, ciudad, logo_url
         FROM instituciones WHERE id = ?`,
        [req.user.institucion_id],
      );
      institucion = inst ?? null;
    }

    const periodos = [...new Set(notas.map((n) => n.periodo))].sort((a, b) =>
      a < b ? 1 : a > b ? -1 : 0,
    );

    const asistenciaResumen = asistencia.reduce(
      (acc, a) => {
        acc.total += 1;
        if (a.estado === "presente") acc.presentes += 1;
        else if (a.estado === "ausente") acc.ausentes += 1;
        else if (a.estado === "tarde") acc.tardes += 1;
        else if (a.estado === "excusa") acc.excusas += 1;
        return acc;
      },
      { total: 0, presentes: 0, ausentes: 0, tardes: 0, excusas: 0 },
    );

    // La definitiva ya viene calculada con la ponderación única (lib/notas.js);
    // aquí solo se agrega el promedio. `n.nota_definitiva` es null mientras la
    // planilla del docente esté incompleta.
    const conNota = notas.filter((n) => n.nota_definitiva != null);
    const promedio =
      conNota.length > 0
        ? conNota.reduce((acc, n) => acc + Number(n.nota_definitiva), 0) / conNota.length
        : null;

    res.json({
      estudiante: { id: est.id, nombre: est.nombre_completo, correo: est.correo, foto_url: est.foto_url },
      curso: curso ?? null,
      institucion,
      periodos,
      notas,
      asistencia,
      asistencia_resumen: asistenciaResumen,
      promedio: promedio != null ? Number(promedio.toFixed(2)) : null,
      materias_cursadas: notas.length,
    });
  }),
);

export default r;
