import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notificar } from "../lib/notificar.js";
import { COLUMNAS_NOTA, recalcularCasillero } from "../lib/notasTareas.js";

const r = Router();
r.use(verifyToken);

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const DT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

// Normaliza una fecha local ("2026-03-15T14:30" o "2026-03-15 14:30:00")
// al formato que acepta MySQL en la columna DATETIME.
function aDatetime(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !DT_RE.test(value)) return null;
  return String(value).replace("T", " ").slice(0, 19);
}

// Un admin todo lo puede. Un profesor solo sobre sus propios grupos y un
// estudiante únicamente sobre los grupos donde está matriculado.
async function puedeVerGrupo(req, res, grupoId) {
  if (req.user.rol === "admin") {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (g) return true;
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  if (req.user.rol === "profesor") {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND profesor_id = ?",
      [grupoId, req.user.id],
    );
    if (g) return true;
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  if (req.user.rol === "estudiante") {
    const [[m]] = await pool.query(
      "SELECT id FROM matriculas WHERE estudiante_id = ? AND grupo_id = ?",
      [req.user.id, grupoId],
    );
    if (m) return true;
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  res.status(403).json({ error: "Prohibido" });
  return false;
}

async function esProfesorDeGrupo(req, grupoId) {
  if (req.user.rol === "admin") {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    return !!g;
  }
  const [[g]] = await pool.query(
    "SELECT id FROM grupos WHERE id = ? AND profesor_id = ?",
    [grupoId, req.user.id],
  );
  return !!g;
}

// Tareas de un grupo con indicadores de entregas (profesor/estudiante del grupo).
r.get(
  "/grupo/:grupo_id",
  asyncHandler(async (req, res) => {
    const grupoId = parseId(req.params.grupo_id);
    if (!grupoId) return res.status(400).json({ error: "ID inválido" });
    if (!(await puedeVerGrupo(req, res, grupoId))) return;
    const [rows] = await pool.query(
      `SELECT t.id, t.titulo, t.descripcion, t.fecha_entrega, t.puntaje_max, t.columna_nota,
            m.nombre AS materia, g.periodo,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.grupo_id = t.grupo_id) AS total_alumnos,
            (SELECT COUNT(*) FROM entregas_tareas e WHERE e.tarea_id = t.id) AS entregados
     FROM tareas t
     JOIN grupos g ON g.id = t.grupo_id
     JOIN materias m ON m.id = g.materia_id
     WHERE t.grupo_id = ?
     ORDER BY t.fecha_entrega`,
      [grupoId],
    );
    res.json(rows);
  }),
);

// Tareas de todas las materias de un estudiante (con su entrega, si existe).
r.get(
  "/estudiante",
  asyncHandler(async (req, res) => {
    if (req.user.rol !== "estudiante")
      return res.status(403).json({ error: "Prohibido" });
    const [rows] = await pool.query(
      `SELECT t.id AS tarea_id, t.titulo, t.descripcion, t.fecha_entrega, t.puntaje_max,
            m.nombre AS materia, m.codigo AS materia_codigo, g.periodo, g.id AS grupo_id,
            e.id AS entrega_id, e.archivo_url, e.fecha_entrega AS fecha_entrega_entrega,
            e.calificacion, e.comentario, e.retroalimentacion
     FROM matriculas mat
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     JOIN tareas t ON t.grupo_id = g.id
     LEFT JOIN entregas_tareas e ON e.tarea_id = t.id AND e.estudiante_id = mat.estudiante_id
     WHERE mat.estudiante_id = ?
     ORDER BY t.fecha_entrega`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

// Crea una tarea para un grupo (profesor del grupo o admin).
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const { grupo_id, titulo, descripcion, fecha_entrega, puntaje_max, columna_nota } =
      req.body;
    const grupoId = parseId(grupo_id);
    if (!grupoId || !titulo || typeof titulo !== "string" || !titulo.trim()) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (req.user.rol !== "profesor" && req.user.rol !== "admin") {
      return res.status(403).json({ error: "Prohibido" });
    }
    if (!(await esProfesorDeGrupo(req, grupoId))) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const columna = columna_nota ?? null;
    if (columna !== null && !COLUMNAS_NOTA.includes(columna)) {
      return res.status(400).json({ error: "Casillero de nota inválido" });
    }

    const puntaje =
      puntaje_max == null || puntaje_max === "" ? 10 : Number(puntaje_max);
    if (!Number.isFinite(puntaje) || puntaje <= 0) {
      return res.status(400).json({ error: "Puntaje inválido" });
    }
    const fecha = aDatetime(fecha_entrega);
    if (fecha_entrega != null && fecha_entrega !== "" && !fecha) {
      return res.status(400).json({ error: "Fecha inválida" });
    }

    const [[grpRow]] = await pool.query("SELECT institucion_id FROM grupos WHERE id = ?", [grupoId]);
    const instId = grpRow?.institucion_id ?? req.user.institucion_id;

    const [result] = await pool.query(
      `INSERT INTO tareas (grupo_id, titulo, descripcion, fecha_entrega, puntaje_max, columna_nota, institucion_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        grupoId,
        titulo.trim(),
        typeof descripcion === "string" ? descripcion.trim() || null : null,
        fecha,
        puntaje,
        columna,
        instId,
      ],
    );

    const [alumnos] = await pool.query(
      `SELECT mat.estudiante_id FROM matriculas mat WHERE mat.grupo_id = ?`,
      [grupoId],
    );
    if (alumnos.length > 0) {
      for (const a of alumnos) {
        await notificar(
          a.estudiante_id,
          "Nueva tarea asignada",
          `Se publicó la tarea "${titulo.trim()}"${fecha ? ` para entregar el ${fecha.slice(0, 10)}` : ""}`,
          "tarea",
        );
      }
    }

    res.json({ ok: true, id: result.insertId });
  }),
);

// Entrega de un estudiante para una tarea de sus materias (upsert).
r.post(
  "/:tarea_id/entregar",
  asyncHandler(async (req, res) => {
    const tareaId = parseId(req.params.tarea_id);
    if (!tareaId) return res.status(400).json({ error: "ID inválido" });
    if (req.user.rol !== "estudiante")
      return res.status(403).json({ error: "Prohibido" });
    const { archivo_url, comentario } = req.body;
    if (
      !archivo_url ||
      typeof archivo_url !== "string" ||
      !archivo_url.trim()
    ) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const [[t]] = await pool.query("SELECT grupo_id FROM tareas WHERE id = ?", [
      tareaId,
    ]);
    if (!t) return res.status(404).json({ error: "Tarea no encontrada" });
    const [[m]] = await pool.query(
      "SELECT id FROM matriculas WHERE estudiante_id = ? AND grupo_id = ?",
      [req.user.id, t.grupo_id],
    );
    if (!m) return res.status(403).json({ error: "No autorizado" });

    await pool.query(
      `INSERT INTO entregas_tareas (tarea_id, estudiante_id, archivo_url, comentario)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE archivo_url = VALUES(archivo_url), comentario = VALUES(comentario)`,
      [tareaId, req.user.id, archivo_url.trim(), comentario ?? null],
    );
    res.json({ ok: true });
  }),
);

// Entregas de una tarea + alumnos que aún no han entregado (revisión profesor).
r.get(
  "/:tarea_id/entregas",
  asyncHandler(async (req, res) => {
    const tareaId = parseId(req.params.tarea_id);
    if (!tareaId) return res.status(400).json({ error: "ID inválido" });
    const [[t]] = await pool.query(
      "SELECT id, grupo_id, titulo, puntaje_max, columna_nota FROM tareas WHERE id = ?",
      [tareaId],
    );
    if (!t) return res.status(404).json({ error: "Tarea no encontrada" });
    if (!(await esProfesorDeGrupo(req, t.grupo_id))) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM matriculas WHERE grupo_id = ?",
      [t.grupo_id],
    );
    const [entregas] = await pool.query(
      `SELECT e.id AS entrega_id, e.estudiante_id, u.nombre_completo AS estudiante, u.correo,
            e.archivo_url, e.fecha_entrega, e.calificacion, e.comentario, e.retroalimentacion
     FROM entregas_tareas e
     JOIN usuarios u ON u.id = e.estudiante_id
     WHERE e.tarea_id = ?
     ORDER BY u.nombre_completo`,
      [tareaId],
    );
    const [sinEntrega] = await pool.query(
      `SELECT u.id AS estudiante_id, u.nombre_completo AS estudiante, u.correo
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     WHERE mat.grupo_id = ?
       AND mat.estudiante_id NOT IN (SELECT estudiante_id FROM entregas_tareas WHERE tarea_id = ?)
     ORDER BY u.nombre_completo`,
      [t.grupo_id, tareaId],
    );
    res.json({
      tarea: t,
      total_alumnos: total,
      entregas,
      sin_entrega: sinEntrega,
    });
  }),
);

// Califica una entrega (calificación y retroalimentación).
r.post(
  "/calificar/:entrega_id",
  asyncHandler(async (req, res) => {
    const entregaId = parseId(req.params.entrega_id);
    if (!entregaId) return res.status(400).json({ error: "ID inválido" });
    const { calificacion, retroalimentacion } = req.body;
    const nota =
      calificacion === "" || calificacion == null ? null : Number(calificacion);
    if (nota !== null && !Number.isFinite(nota)) {
      return res.status(400).json({ error: "Calificación inválida" });
    }
    if (nota !== null && nota < 0) {
      return res
        .status(400)
        .json({ error: "La calificación no puede ser negativa" });
    }

    const [[e]] = await pool.query(
      `SELECT e.id, e.estudiante_id, e.tarea_id, t.puntaje_max, t.columna_nota, t.grupo_id
     FROM entregas_tareas e
     JOIN tareas t ON t.id = e.tarea_id
     WHERE e.id = ?`,
      [entregaId],
    );
    if (!e) return res.status(404).json({ error: "Entrega no encontrada" });
    if (!(await esProfesorDeGrupo(req, e.grupo_id))) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (nota !== null && nota > Number(e.puntaje_max)) {
      return res.status(400).json({ error: "Calificación fuera de rango" });
    }

    await pool.query(
      "UPDATE entregas_tareas SET calificacion = ?, retroalimentacion = ? WHERE id = ?",
      [nota, retroalimentacion ?? null, entregaId],
    );

    // Si la tarea está vinculada a un casillero de la planilla, sincroniza la
    // nota del estudiante (promedio de tareas del casillero).
    if (e.columna_nota) {
      await recalcularCasillero({
        estudianteId: e.estudiante_id,
        grupoId: e.grupo_id,
        columna: e.columna_nota,
      });
    }
    res.json({ ok: true });
  }),
);

export default r;
