import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken);

const TIPOS = ["institucional", "evaluacion", "entrega", "reunion"];
const DT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

function aDatetime(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !DT_RE.test(value)) return null;
  return String(value).replace("T", " ").slice(0, 19);
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Devuelve la agenda combinada del usuario: eventos del calendario académico +
// fechas límite de las tareas de sus grupos (como eventos tipo "entrega").
r.get(
  "/eventos",
  asyncHandler(async (req, res) => {
    const { rol, id } = req.user;
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    // Las tareas como eventos aplican a admin, profesor y estudiante. El acudiente
    // solo ve los eventos institucionales (no tiene grupos propios).
    let tareas = [];
    if (rol !== "acudiente") {
      let tareasSql = `SELECT t.id, t.titulo, t.descripcion, t.fecha_entrega, t.puntaje_max,
                            m.nombre AS materia, g.periodo, 'entrega' AS tipo, NULL AS id_evento
                     FROM tareas t
                     JOIN grupos g ON g.id = t.grupo_id
                     JOIN materias m ON m.id = g.materia_id`;
      const p = [];
      const conds = [];
      if (rol === "estudiante") {
        tareasSql += " JOIN matriculas mat ON mat.grupo_id = g.id";
        conds.push("mat.estudiante_id = ?");
        p.push(id);
      } else if (rol === "profesor") {
        conds.push("g.profesor_id = ?");
        p.push(id);
      } else if (rol === "admin" && req.user.institucion_id) {
        conds.push("g.institucion_id = ?");
        p.push(req.user.institucion_id);
      }
      if (desde) {
        conds.push("t.fecha_entrega >= ?");
        p.push(`${desde} 00:00:00`);
      }
      if (hasta) {
        conds.push("t.fecha_entrega <= ?");
        p.push(`${hasta} 23:59:59`);
      }
      if (conds.length) tareasSql += " WHERE " + conds.join(" AND ");
      tareasSql += " ORDER BY t.fecha_entrega";
      const [rows] = await pool.query(tareasSql, p);
      tareas = rows;
    }

    const evConds = [];
    const evParams = [];
    if (req.user.institucion_id) {
      evConds.push("institucion_id = ?");
      evParams.push(req.user.institucion_id);
    }
    if (desde) {
      evConds.push("fecha_inicio >= ?");
      evParams.push(`${desde} 00:00:00`);
    }
    if (hasta) {
      evConds.push("fecha_inicio <= ?");
      evParams.push(`${hasta} 23:59:59`);
    }
    let eventosSql = `SELECT id AS id_evento, titulo, descripcion, fecha_inicio, fecha_fin, tipo, curso_id
     FROM eventos_calendario`;
    if (evConds.length) eventosSql += " WHERE " + evConds.join(" AND ");
    eventosSql += " ORDER BY fecha_inicio";
    const [eventos] = await pool.query(eventosSql, evParams);

    const eventosNorm = eventos.map((ev) => ({
      id: `evento-${ev.id_evento}`,
      origen: "evento",
      titulo: ev.titulo,
      descripcion: ev.descripcion,
      materia: null,
      fecha_inicio: ev.fecha_inicio,
      fecha_fin: ev.fecha_fin,
      tipo: ev.tipo,
    }));
    const tareasNorm = tareas.map((t) => ({
      id: `tarea-${t.id}`,
      origen: "tarea",
      titulo: t.titulo,
      descripcion: t.descripcion,
      materia: t.materia,
      fecha_inicio: t.fecha_entrega,
      fecha_fin: null,
      tipo: "entrega",
    }));

    const todos = [...eventosNorm, ...tareasNorm].sort(
      (a, b) =>
        new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime(),
    );
    res.json(todos);
  }),
);

// Agenda un evento del calendario académico (admin cualquier tipo, profesor
// solo evaluaciones/reuniones).
r.post(
  "/eventos",
  asyncHandler(async (req, res) => {
    const { titulo, descripcion, fecha_inicio, fecha_fin, tipo, curso_id } =
      req.body;
    if (
      !titulo ||
      typeof titulo !== "string" ||
      !titulo.trim() ||
      !fecha_inicio
    ) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const t = tipo ?? "institucional";
    if (!TIPOS.includes(t))
      return res.status(400).json({ error: "Tipo inválido" });
    if (req.user.rol !== "admin" && req.user.rol !== "profesor") {
      return res.status(403).json({ error: "Prohibido" });
    }
    if (req.user.rol === "profesor" && t === "institucional") {
      return res.status(403).json({ error: "No autorizado" });
    }
    const inicio = aDatetime(fecha_inicio);
    if (!inicio) return res.status(400).json({ error: "Fecha inválida" });
    const fin = aDatetime(fecha_fin);
    const cursoId =
      curso_id == null || curso_id === "" ? null : parseId(curso_id);
    if (curso_id != null && curso_id !== "" && !cursoId) {
      return res.status(400).json({ error: "Curso inválido" });
    }

    const [result] = await pool.query(
      `INSERT INTO eventos_calendario (titulo, descripcion, fecha_inicio, fecha_fin, tipo, curso_id, institucion_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [titulo.trim(), descripcion ?? null, inicio, fin, t, cursoId, req.user.institucion_id],
    );
    res.json({ ok: true, id: result.insertId });
  }),
);

export default r;
