import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notificar } from "../lib/notificar.js";

const r = Router();
r.use(verifyToken);

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// El usuario solo puede ver sus propias conversaciones (o un admin cualquiera).
async function puedeAcceder(req, res, usuarioId) {
  if (req.user.id === usuarioId) return true;
  if (req.user.rol === "admin") {
    const [[u]] = await pool.query("SELECT institucion_id FROM usuarios WHERE id = ?", [usuarioId]);
    if (u && u.institucion_id === req.user.institucion_id) return true;
  }
  res.status(403).json({ error: "Prohibido" });
  return false;
}

// Conversaciones activas de un usuario con sus contactos.
r.get("/conversaciones/:usuario_id", asyncHandler(async (req, res) => {
  const usuarioId = parseId(req.params.usuario_id);
  if (!usuarioId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeAcceder(req, res, usuarioId))) return;

  const [rows] = await pool.query(
    `SELECT u.id AS contacto_id, u.nombre_completo, u.correo, u.rol,
            (SELECT m.contenido FROM mensajes m
             WHERE (m.remitente_id = ? AND m.destinatario_id = u.id)
                OR (m.destinatario_id = ? AND m.remitente_id = u.id)
             ORDER BY m.fecha_envio DESC LIMIT 1) AS ultimo_mensaje,
            (SELECT m.fecha_envio FROM mensajes m
             WHERE (m.remitente_id = ? AND m.destinatario_id = u.id)
                OR (m.destinatario_id = ? AND m.remitente_id = u.id)
             ORDER BY m.fecha_envio DESC LIMIT 1) AS ultima_fecha,
            (SELECT COUNT(*) FROM mensajes m
             WHERE m.destinatario_id = ? AND m.remitente_id = u.id AND m.leido = 0) AS no_leidas
     FROM usuarios u
     WHERE u.id IN (
       SELECT CASE WHEN m.remitente_id = ? THEN m.destinatario_id ELSE m.remitente_id END
       FROM mensajes m
       WHERE m.remitente_id = ? OR m.destinatario_id = ?
     )
     ORDER BY ultima_fecha DESC`,
    [usuarioId, usuarioId, usuarioId, usuarioId, usuarioId, usuarioId, usuarioId, usuarioId],
  );

  res.json(
    rows.map((x) => ({
      contacto_id: x.contacto_id,
      nombre: x.nombre_completo,
      correo: x.correo,
      rol: x.rol,
      ultimo_mensaje: x.ultimo_mensaje,
      ultima_fecha: x.ultima_fecha,
      no_leidas: Number(x.no_leidas || 0),
    })),
  );
}));

// Hilo completo de mensajes entre el usuario y un contacto.
r.get("/conversacion/:usuario_id/:contacto_id", asyncHandler(async (req, res) => {
  const usuarioId = parseId(req.params.usuario_id);
  const contactoId = parseId(req.params.contacto_id);
  if (!usuarioId || !contactoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeAcceder(req, res, usuarioId))) return;

  const [rows] = await pool.query(
    `SELECT id, remitente_id, destinatario_id, contenido, leido, fecha_envio
     FROM mensajes
     WHERE (remitente_id = ? AND destinatario_id = ?)
        OR (remitente_id = ? AND destinatario_id = ?)
     ORDER BY fecha_envio ASC`,
    [usuarioId, contactoId, contactoId, usuarioId],
  );
  res.json(rows);
}));

// Contactos potenciales: usuarios activos que pueden recibir mensajes (excluye a sí mismo).
r.get("/contactos", asyncHandler(async (req, res) => {
  // La mensajería es intra-institucional: el superadmin no tiene institución.
  if (!req.user.institucion_id) {
    return res.status(403).json({ error: "Prohibido" });
  }
  const { q } = req.query;
  const params = [req.user.id];
  let where = "u.estado = 'activo' AND u.id <> ?";
  if (req.user.institucion_id) {
    where += " AND u.institucion_id = ?";
    params.push(req.user.institucion_id);
  }
  if (q && String(q).trim()) {
    where += " AND (u.nombre_completo LIKE ? OR u.correo LIKE ?)";
    const term = `%${String(q).trim()}%`;
    params.push(term, term);
  }
  const [rows] = await pool.query(
    `SELECT u.id AS contacto_id, u.nombre_completo, u.correo, u.rol
     FROM usuarios u
     WHERE ${where}
     ORDER BY u.nombre_completo
     LIMIT 20`,
    params,
  );
  res.json(rows.map((x) => ({
    contacto_id: x.contacto_id,
    nombre: x.nombre_completo,
    correo: x.correo,
    rol: x.rol,
  })));
}));

// Envía un mensaje de texto a otro usuario.
r.post("/enviar", asyncHandler(async (req, res) => {
  const { destinatario_id, contenido } = req.body || {};
  const destinatarioId = parseId(destinatario_id);
  if (!destinatarioId) return res.status(400).json({ error: "Faltan datos" });
  if (!contenido || typeof contenido !== "string" || !contenido.trim()) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  if (destinatarioId === req.user.id) {
    return res.status(400).json({ error: "No puedes enviarte mensajes a ti mismo" });
  }
  const [[dest]] = await pool.query(
    "SELECT id, nombre_completo, institucion_id FROM usuarios WHERE id = ? AND estado = 'activo'",
    [destinatarioId],
  );
  if (!dest) return res.status(404).json({ error: "Destinatario no encontrado" });
  // Mensajería solo dentro de la misma institución. El superadmin (sin
  // institución) no participa de la mensajería académica.
  if (!req.user.institucion_id) {
    return res.status(403).json({ error: "Prohibido" });
  }
  if (dest.institucion_id !== req.user.institucion_id) {
    return res.status(403).json({ error: "No puedes enviar mensajes a usuarios de otra institución" });
  }

  const [result] = await pool.query(
    `INSERT INTO mensajes (remitente_id, destinatario_id, contenido, leido, institucion_id)
     VALUES (?, ?, ?, 0, ?)`,
    [req.user.id, destinatarioId, contenido.trim(), req.user.institucion_id],
  );

  await notificar(
    destinatarioId,
    "Nuevo mensaje",
    `${req.user.nombre || "Alguien"} te escribió: "${contenido.trim().slice(0, 80)}"`,
    "mensaje",
  );

  res.json({
    ok: true,
    mensaje: {
      id: result.insertId,
      remitente_id: req.user.id,
      destinatario_id: destinatarioId,
      contenido: contenido.trim(),
      leido: 0,
      fecha_envio: new Date().toISOString(),
    },
  });
}));

// Marca como leídos todos los mensajes de un contacto hacia el usuario.
r.put("/leidas/:usuario_id/:contacto_id", asyncHandler(async (req, res) => {
  const usuarioId = parseId(req.params.usuario_id);
  const contactoId = parseId(req.params.contacto_id);
  if (!usuarioId || !contactoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeAcceder(req, res, usuarioId))) return;

  await pool.query(
    "UPDATE mensajes SET leido = 1 WHERE destinatario_id = ? AND remitente_id = ? AND leido = 0",
    [usuarioId, contactoId],
  );
  res.json({ ok: true });
}));

export default r;
