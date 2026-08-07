import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken);

const ESTADOS = ["presente", "ausente", "tarde", "excusa"];

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
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

// Registro de asistencia de un grupo en una fecha (la de hoy por defecto).
r.get("/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;
  const qFecha = String(req.query.fecha ?? "");
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(qFecha)
    ? qFecha
    : new Date().toISOString().slice(0, 10);
  const [rows] = await pool.query(
    `SELECT mat.id AS matricula_id, u.id AS estudiante_id,
            u.nombre_completo AS estudiante, u.correo,
            a.fecha, a.estado, a.observacion
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id AND a.fecha = ?
     WHERE mat.grupo_id = ?
     ORDER BY u.nombre_completo`,
    [fecha, grupoId],
  );
  res.json({ fecha, registros: rows });
}));

// Guarda la lista de asistencia del día para un grupo (arreglo de estudiantes).
r.post("/registrar", asyncHandler(async (req, res) => {
  const { grupo_id, fecha, registros } = req.body;
  const grupoId = parseId(grupo_id);
  if (!grupoId || !fecha || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Fecha inválida" });
  }
  if (req.user.rol !== "admin") {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND profesor_id = ?",
      [grupoId, req.user.id],
    );
    if (!g) return res.status(403).json({ error: "No autorizado" });
  }

  // Cada matrícula debe pertenecer al grupo (evita inyectar asistencia ajena)
  // y no puede repetirse dentro de la lista.
  const ids = registros.map((reg) => Number(reg.matricula_id));
  const idsValidos = ids.every((n) => Number.isInteger(n) && n > 0);
  if (!idsValidos || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "Registro inválido" });
  }
  const marcadores = ids.map(() => "?").join(", ");
  const [pertenecientes] = await pool.query(
    `SELECT id FROM matriculas WHERE grupo_id = ? AND id IN (${marcadores})`,
    [grupoId, ...ids],
  );
  if (pertenecientes.length !== ids.length) {
    return res.status(400).json({
      error: "Uno o más estudiantes no pertenecen a este grupo",
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const reg of registros) {
      if (!reg.matricula_id || !ESTADOS.includes(reg.estado)) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: "Registro inválido" });
      }
      await conn.query(
        `INSERT INTO asistencia (matricula_id, fecha, estado, observacion)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE estado = VALUES(estado), observacion = VALUES(observacion)`,
        [reg.matricula_id, fecha, reg.estado, reg.observacion ?? null],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ ok: true, fecha, guardados: registros.length });
}));

// Resumen global de asistencia y fallas por materia de un estudiante.
// Un profesor solo ve las materias que dicta a ese estudiante (sin fuga entre
// materias/carreras); admin y el propio estudiante ven el histórico completo.
r.get("/resumen/estudiante/:estudiante_id", asyncHandler(async (req, res) => {
  const estudianteId = parseId(req.params.estudiante_id);
  if (!estudianteId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerEstudiante(req, res, estudianteId))) return;
  const params = [estudianteId];
  const filtroProfesor =
    req.user.rol === "profesor" ? " AND g.profesor_id = ?" : "";
  if (filtroProfesor) params.push(req.user.id);
  const [rows] = await pool.query(
    `SELECT m.nombre AS materia, COALESCE(a.estado, 'sin_registro') AS estado, COUNT(*) AS total
     FROM matriculas mat
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id
     WHERE mat.estudiante_id = ?${filtroProfesor}
     GROUP BY m.nombre, a.estado
     ORDER BY m.nombre`,
    params,
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.materia)) {
      map.set(row.materia, { presentes: 0, ausentes: 0, tardes: 0, excusas: 0, sin_registro: 0, total: 0 });
    }
    const m = map.get(row.materia);
    m.total += row.total;
    if (row.estado === "presente") m.presentes += row.total;
    else if (row.estado === "ausente") m.ausentes += row.total;
    else if (row.estado === "tarde") m.tardes += row.total;
    else if (row.estado === "excusa") m.excusas += row.total;
    else m.sin_registro += row.total;
  }

  const porMateria = [...map.entries()].map(([materia, m]) => {
    const registrados = m.presentes + m.ausentes + m.tardes + m.excusas;
    return {
      materia,
      presentes: m.presentes,
      ausentes: m.ausentes,
      tardes: m.tardes,
      excusas: m.excusas,
      total: registrados,
      fallas: m.ausentes + m.tardes,
      porcentaje: registrados > 0 ? Math.round((m.presentes / registrados) * 100) : null,
    };
  });

  const totalRegistros = porMateria.reduce((s, m) => s + m.total, 0);
  const presentes = porMateria.reduce((s, m) => s + m.presentes, 0);
  const ausentes = porMateria.reduce((s, m) => s + m.ausentes, 0);
  const tardes = porMateria.reduce((s, m) => s + m.tardes, 0);
  const excusas = porMateria.reduce((s, m) => s + m.excusas, 0);

  res.json({
    total_registros: totalRegistros,
    presentes,
    ausentes,
    tardes,
    excusas,
    porcentaje_asistencia: totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0,
    total_fallas: ausentes + tardes,
    por_materia: porMateria,
  });
}));

export default r;
