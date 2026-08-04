import { pool } from "../db.js";

/** Inserta una notificación para un usuario. Tipos: sistema | nota | tarea | mensaje | evento. */
export async function notificar(usuario_id, titulo, mensaje, tipo = "sistema") {
  await pool.query(
    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida) VALUES (?, ?, ?, ?, 0)",
    [usuario_id, titulo, mensaje, tipo],
  );
}
