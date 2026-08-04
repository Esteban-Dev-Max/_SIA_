import { Router } from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken);

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Listado + contador de notificaciones pendientes del usuario.
r.get("/:usuario_id", asyncHandler(async (req, res) => {
  const usuarioId = parseId(req.params.usuario_id);
  if (!usuarioId) return res.status(400).json({ error: "ID inválido" });
  if (req.user.rol !== "admin" && req.user.id !== usuarioId) {
    return res.status(403).json({ error: "Prohibido" });
  }

  const [[{ pendientes }]] = await pool.query(
    "SELECT COUNT(*) AS pendientes FROM notificaciones WHERE usuario_id = ? AND leida = 0",
    [usuarioId],
  );
  const [notificaciones] = await pool.query(
    `SELECT id, titulo, mensaje, tipo, leida, fecha_creacion
     FROM notificaciones
     WHERE usuario_id = ?
     ORDER BY fecha_creacion DESC
     LIMIT 50`,
    [usuarioId],
  );

  res.json({ pendientes: Number(pendientes), notificaciones });
}));

// Marca una notificación como leída.
r.put("/marcar-leida/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const [[n]] = await pool.query(
    "SELECT usuario_id FROM notificaciones WHERE id = ?",
    [id],
  );
  if (!n) return res.status(404).json({ error: "Notificación no encontrada" });
  if (req.user.rol !== "admin" && req.user.id !== n.usuario_id) {
    return res.status(403).json({ error: "Prohibido" });
  }

  await pool.query("UPDATE notificaciones SET leida = 1 WHERE id = ?", [id]);
  res.json({ ok: true });
}));

// Marca todas las notificaciones del usuario como leídas.
r.put("/marcar-todas/:usuario_id", asyncHandler(async (req, res) => {
  const usuarioId = parseId(req.params.usuario_id);
  if (!usuarioId) return res.status(400).json({ error: "ID inválido" });
  if (req.user.rol !== "admin" && req.user.id !== usuarioId) {
    return res.status(403).json({ error: "Prohibido" });
  }

  await pool.query(
    "UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0",
    [usuarioId],
  );
  res.json({ ok: true });
}));

export default r;
