import { pool } from "../db.js";

/** Inserta una notificación para un usuario. Tipos: sistema | nota | tarea | mensaje | evento. */
export async function notificar(usuario_id, titulo, mensaje, tipo = "sistema") {
  const [[u]] = await pool.query("SELECT institucion_id FROM usuarios WHERE id = ?", [usuario_id]);
  await pool.query(
    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida, institucion_id) VALUES (?, ?, ?, ?, 0, ?)",
    [usuario_id, titulo, mensaje, tipo, u?.institucion_id ?? null],
  );
}
