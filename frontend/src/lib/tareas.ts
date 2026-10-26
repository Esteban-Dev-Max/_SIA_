// Reglas del puntaje de las tareas. Deben coincidir con
// backend/lib/notasTareas.js (PUNTAJE_MAX_TAREA).
export const PUNTAJE_MAX_TAREA = 5;
export const PUNTAJE_MIN_TAREA = 1;

/** Devuelve el mensaje de error, o null si el puntaje es válido.
 * Un valor vacío se considera válido: el backend aplica el máximo por defecto. */
export function validarPuntajeMaximo(valor: string | number | null | undefined): string | null {
  const texto = typeof valor === "string" ? valor.trim() : valor;
  if (texto === null || texto === undefined || texto === "") return null;

  const puntaje = Number(texto);
  if (!Number.isFinite(puntaje)) return "El puntaje debe ser un número";
  if (puntaje < PUNTAJE_MIN_TAREA) {
    return `El puntaje debe ser mayor o igual a ${PUNTAJE_MIN_TAREA}`;
  }
  if (puntaje > PUNTAJE_MAX_TAREA) {
    return `El puntaje máximo no puede superar ${PUNTAJE_MAX_TAREA}`;
  }
  return null;
}
