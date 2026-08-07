// ---------------------------------------------------------------------------
// Ponderación de notas — única fuente de verdad del sistema.
// Definición: nota_1 (25%) + nota_2 (25%) + nota_3 (20%) + examen_final (30%).
// Todos los cálculos del backend y del frontend deben importar estas
// funciones/constantes para evitar divergencias (antes estaba duplicada en
// routes/notas.js, seed.js y el frontend).
// ---------------------------------------------------------------------------

export const PONDERACION = {
  nota_1: 0.25,
  nota_2: 0.25,
  nota_3: 0.2,
  examen_final: 0.3,
};

export const CAMPOS_NOTA = ["nota_1", "nota_2", "nota_3", "examen_final"];

/** Convierte un valor en número (cadena vacía/null/indefinido/NaN → null). */
export function normalizarNumero(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Todas las notas están presentes y dentro del rango [0, 5]. */
export function notasCompletas(notas) {
  return CAMPOS_NOTA.every(
    (c) => notas[c] != null && notas[c] >= 0 && notas[c] <= 5,
  );
}

/** Calcula la definitiva con las 4 notas (redondeo a 2 decimales).
 * Devuelve null si falta alguna nota: no se rellena con 0, para no mostrar
 * una definitiva engañosa mientras la planilla está incompleta. */
export function calcularDefinitiva(notas) {
  if (!notasCompletas(notas)) return null;
  const total = CAMPOS_NOTA.reduce((s, c) => s + notas[c] * PONDERACION[c], 0);
  // Epsilon para neutralizar el ruido de punto flotante (p. ej. 3.975 da 3.98).
  return Math.round((total + 1e-9) * 100) / 100;
}