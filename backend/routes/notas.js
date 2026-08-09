import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notificar } from "../lib/notificar.js";
import { calcularDefinitiva, normalizarNumero } from "../lib/notas.js";

const r = Router();
r.use(verifyToken);

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Un admin todo lo puede. Un profesor solo sobre estudiantes a los que dicta
// clase y un estudiante únicamente sobre su propio perfil.
async function puedeVerEstudiante(req, res, estudianteId) {
  const { rol, id } = req.user;
  if (rol === "admin") return true;
  if (rol === "estudiante") {
    if (id !== estudianteId) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  if (rol === "profesor") {
    const [[p]] = await pool.query(
      `SELECT mat.id FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       WHERE mat.estudiante_id = ? AND g.profesor_id = ?
       LIMIT 1`,
      [estudianteId, id],
    );
    if (!p) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  res.status(403).json({ error: "Prohibido" });
  return false;
}

async function puedeVerGrupo(req, res, grupoId) {
  if (req.user.rol === "admin") return true;
  const [[g]] = await pool.query(
    "SELECT id FROM grupos WHERE id = ? AND profesor_id = ?",
    [grupoId, req.user.id],
  );
  if (!g) {
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  return true;
}

// Desglose de notas de un estudiante por materia.
// Un profesor solo ve las materias que dicta a ese estudiante (sin fuga entre
// materias/carreras); admin y el propio estudiante ven el histórico completo.
r.get(
  "/estudiante/:estudiante_id",
  asyncHandler(async (req, res) => {
    const estudianteId = parseId(req.params.estudiante_id);
    if (!estudianteId) return res.status(400).json({ error: "ID inválido" });
    if (!(await puedeVerEstudiante(req, res, estudianteId))) return;
    const params = [estudianteId];
    const filtroProfesor =
      req.user.rol === "profesor" ? " AND g.profesor_id = ?" : "";
    if (filtroProfesor) params.push(req.user.id);
    const [rows] = await pool.query(
      `SELECT g.id AS grupo_id, g.periodo, m.nombre AS materia, m.codigo AS materia_codigo,
            mat.id AS matricula_id, n.nota_1, n.nota_2, n.nota_3, n.examen_final,
            n.nota_definitiva, n.observaciones
     FROM matriculas mat
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     LEFT JOIN notas n ON n.matricula_id = mat.id
     WHERE mat.estudiante_id = ?${filtroProfesor}
     ORDER BY g.periodo DESC, m.nombre`,
      params,
    );
    res.json(rows);
  }),
);

// Planilla de notas de todos los estudiantes de un grupo.
r.get(
  "/grupo/:grupo_id",
  asyncHandler(async (req, res) => {
    const grupoId = parseId(req.params.grupo_id);
    if (!grupoId) return res.status(400).json({ error: "ID inválido" });
    if (!(await puedeVerGrupo(req, res, grupoId))) return;
    const [rows] = await pool.query(
      `SELECT mat.id AS matricula_id, u.id AS estudiante_id,
            u.nombre_completo AS estudiante, u.correo,
            n.nota_1, n.nota_2, n.nota_3, n.examen_final, n.nota_definitiva, n.observaciones
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN notas n ON n.matricula_id = mat.id
     WHERE mat.grupo_id = ?
     ORDER BY u.nombre_completo`,
      [grupoId],
    );
    res.json(rows);
  }),
);

// Registra o actualiza las notas de un estudiante y calcula la definitiva.
// Fórmula: (Nota1 * 0.25) + (Nota2 * 0.25) + (Nota3 * 0.20) + (ExamenFinal * 0.30)
r.post(
  "/guardar",
  asyncHandler(async (req, res) => {
    const {
      matricula_id,
      nota_1,
      nota_2,
      nota_3,
      examen_final,
      observaciones,
    } = req.body;
    const matriculaId = parseId(matricula_id);
    if (!matriculaId) return res.status(400).json({ error: "Faltan datos" });
    if (req.user.rol !== "admin") {
      const [[m]] = await pool.query(
        `SELECT mat.id FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       WHERE mat.id = ? AND g.profesor_id = ?`,
        [matriculaId, req.user.id],
      );
      if (!m) return res.status(403).json({ error: "No autorizado" });
    }

    const a = normalizarNumero(nota_1);
    const b = normalizarNumero(nota_2);
    const c = normalizarNumero(nota_3);
    const d = normalizarNumero(examen_final);
    const enRango = (v) =>
      v === null || (typeof v === "number" && v >= 0 && v <= 5);
    if (![a, b, c, d].every(enRango)) {
      return res
        .status(400)
        .json({ error: "Las notas deben estar entre 0 y 5" });
    }
    const observacionFinal =
      typeof observaciones === "string" && observaciones.trim()
        ? observaciones.trim()
        : null;
    // La definitiva solo se calcula con las 4 notas completas (ver lib/notas.js).
    const nota_definitiva = calcularDefinitiva({
      nota_1: a,
      nota_2: b,
      nota_3: c,
      examen_final: d,
    });

    await pool.query(
      `INSERT INTO notas (matricula_id, nota_1, nota_2, nota_3, examen_final, nota_definitiva, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nota_1 = VALUES(nota_1), nota_2 = VALUES(nota_2), nota_3 = VALUES(nota_3),
       examen_final = VALUES(examen_final), nota_definitiva = VALUES(nota_definitiva),
       observaciones = VALUES(observaciones)`,
      [matriculaId, a, b, c, d, nota_definitiva, observacionFinal],
    );

    if (nota_definitiva !== null) {
      const [[info]] = await pool.query(
        `SELECT mat.estudiante_id, m.nombre AS materia
       FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       JOIN materias m ON m.id = g.materia_id
       WHERE mat.id = ?`,
        [matriculaId],
      );
      if (info) {
        await notificar(
          info.estudiante_id,
          "Nueva calificación",
          `Se publicó tu calificación de ${info.materia}: ${nota_definitiva.toFixed(2)}`,
          "nota",
        );
      }
    }

    res.json({ ok: true, nota_definitiva });
  }),
);

export default r;
