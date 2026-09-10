// ---------------------------------------------------------------------------
// Sincronización de Tareas → Planilla de Notas.
// Cuando el profesor califica una entrega, la nota se reescala de la escala de
// la tarea (0..puntaje_max) a la escala de la planilla (0.0–5.0) y se escribe
// automáticamente en el casillero (columna_nota) al que la tarea está
// vinculada. Si varias tareas apuntan al mismo casillero, se promedia.
// Las tareas sin columna_nota (NULL) no tocan la planilla.
// ---------------------------------------------------------------------------

import { pool } from "../db.js";
import { notificar } from "./notificar.js";
import { calcularDefinitiva, CAMPOS_NOTA } from "./notas.js";

/** Rubros de la planilla a los que puede apuntar una tarea (ENUM de la BD). */
export const COLUMNAS_NOTA = ["nota_1", "nota_2", "nota_3", "examen_final"];

const ETIQUETA = {
  nota_1: "Nota 1",
  nota_2: "Nota 2",
  nota_3: "Nota 3",
  examen_final: "Examen Final",
};

function redondear(n) {
  return Math.round((n + 1e-9) * 100) / 100;
}

/** Reescala una calificación de tarea a la escala 0.0–5.0 de la planilla.
 * Ej. 9 sobre 10 → 4.5. Devuelve null sin calificación o con puntaje inválido. */
export function reescalarNota(calificacion, puntajeMax) {
  if (calificacion === null || calificacion === undefined) return null;
  const c = Number(calificacion);
  const p = Number(puntajeMax);
  if (!Number.isFinite(c) || !(p > 0)) return null;
  return redondear((c / p) * 5);
}

/** Promedio de notas de tareas reescaladas (una por entrega calificada).
 * Devuelve null si no hay ninguna entrega calificada. */
export function promedioNotas(entregas) {
  const notas = entregas
    .map((e) => reescalarNota(e.calificacion, e.puntaje_max))
    .filter((v) => v !== null);
  if (notas.length === 0) return null;
  return redondear(notas.reduce((s, n) => s + n, 0) / notas.length);
}

/** Recalcula el casillero de un estudiante a partir de sus entregas calificadas
 * en las tareas del grupo vinculadas a esa columna, escribe el resultado en la
 * tabla `notas` (con la definitiva recalculada) y notifica al estudiante si el
 * valor cambió. Devuelve el valor escrito (o null si no hay matrícula/columna). */
export async function recalcularCasillero({ estudianteId, grupoId, columna }) {
  if (!COLUMNAS_NOTA.includes(columna)) return null;

  const [[mat]] = await pool.query(
    "SELECT id FROM matriculas WHERE estudiante_id = ? AND grupo_id = ?",
    [estudianteId, grupoId],
  );
  if (!mat) return null;

  const [entregas] = await pool.query(
    `SELECT e.calificacion, t.puntaje_max
     FROM entregas_tareas e
     JOIN tareas t ON t.id = e.tarea_id
     WHERE e.estudiante_id = ? AND t.grupo_id = ? AND t.columna_nota = ? AND e.calificacion IS NOT NULL`,
    [estudianteId, grupoId, columna],
  );
  const promedio = promedioNotas(entregas);

  const [[existente]] = await pool.query("SELECT * FROM notas WHERE matricula_id = ?", [mat.id]);
  const prev = existente ?? {};
  const prevValor = prev[columna] ?? null;

  if (promedio === null && !existente) {
    // No hay nada que limpiar todavía.
    return null;
  }
  if (prevValor !== null && promedio !== null && Number(prevValor) === promedio) {
    return promedio;
  }

  const notas = { ...CAMPOS_NOTA.reduce((acc, c) => ({ ...acc, [c]: prev[c] ?? null }), {}) };
  notas[columna] = promedio;
  const notaDefinitiva = calcularDefinitiva(notas);

  await pool.query(
    `INSERT INTO notas (matricula_id, \`${columna}\`, nota_definitiva)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       \`${columna}\` = VALUES(\`${columna}\`),
       nota_definitiva = VALUES(nota_definitiva)`,
    [mat.id, promedio, notaDefinitiva],
  );

  if (promedio !== null) {
    const [[g]] = await pool.query(
      `SELECT m.nombre AS materia FROM grupos g JOIN materias m ON m.id = g.materia_id WHERE g.id = ?`,
      [grupoId],
    );
    await notificar(
      estudianteId,
      "Nota actualizada desde tareas",
      `Tu nota de ${ETIQUETA[columna]} en ${g?.materia ?? "la materia"} se actualizó a ${promedio.toFixed(2)} (promedio de tareas)`,
      "nota",
    );
  }

  return promedio;
}