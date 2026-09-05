import { app } from "../../app.js";
import { pool } from "../../db.js";

export { app };

/** Termina el pool MySQL después de los tests para que el proceso termine. */
export async function teardownDB() {
  try {
    await pool.end();
  } catch {
    // ignora errores al cerrar
  }
}
