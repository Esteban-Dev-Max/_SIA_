import path from "node:path";

// Formatos aceptados en las entregas de tareas. Se valida por extensión
// (más estable que el MIME que envía el navegador, sobre todo en DOC/PPT/ZIP).
export const EXTENSIONES_ENTREGA = [
  "pdf",
  "doc",
  "docx",
  "odt",
  "txt",
  "rtf",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "zip",
  "rar",
  "7z",
];

export const TAMANO_MAX_ENTREGA = 10 * 1024 * 1024; // 10 MB

/** Nombre original apto para una columna VARCHAR(255), conservando la extensión. */
export function nombreOriginalSeguro(nombre, max = 255) {
  const base =
    typeof nombre === "string" && nombre.trim() ? nombre.trim().replace(/[\\/]+/g, "/") : "entrega";
  const limpio = base.split("/").pop() || "entrega";
  if (limpio.length <= max) return limpio;
  const ext = path.extname(limpio).slice(0, 20);
  return limpio.slice(0, max - ext.length) + ext;
}

/** Extensión en minúsculas y sin punto ("PDF" -> "pdf"), o "" si no tiene. */
export function extensionArchivo(nombre) {
  if (typeof nombre !== "string") return "";
  return path.extname(nombre).replace(/^\./, "").toLowerCase();
}

/** true si la extensión del archivo está en la lista permitida. */
export function extensionPermitida(nombre) {
  return EXTENSIONES_ENTREGA.includes(extensionArchivo(nombre));
}

/** true si la fecha límite ya pasó (o si no hay fecha límite: nunca es tardía). */
export function esEntregaTardia(fechaLimite, ahora = new Date()) {
  if (!fechaLimite) return false;
  const limite = fechaLimite instanceof Date ? fechaLimite : new Date(fechaLimite);
  if (Number.isNaN(limite.getTime())) return false;
  return ahora.getTime() > limite.getTime();
}
