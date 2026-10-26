// Reglas de los adjuntos de tareas. Deben coincidir con
// backend/lib/archivosEntrega.js (extensiones y tamaño máximo).
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

export const TAMANO_MAX_ENTREGA_MB = 10;
export const TAMANO_MAX_ENTREGA = TAMANO_MAX_ENTREGA_MB * 1024 * 1024;

/** Valor para el atributo accept del <input type="file">. */
export const ACCEPT_ENTREGA = EXTENSIONES_ENTREGA.map((ext) => `.${ext}`).join(",");

export function extensionArchivo(nombre: string): string {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? partes.pop()! : "";
}

/** Devuelve el mensaje de error, o null si el archivo es válido. */
export function validarArchivoEntrega(archivo: File): string | null {
  if (!EXTENSIONES_ENTREGA.includes(extensionArchivo(archivo.name))) {
    return `Formato no permitido. Usa: ${EXTENSIONES_ENTREGA.join(", ")}`;
  }
  if (archivo.size > TAMANO_MAX_ENTREGA) {
    return `El archivo supera el tamaño máximo permitido (${TAMANO_MAX_ENTREGA_MB} MB)`;
  }
  return null;
}

export function formatearBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
