// ---------------------------------------------------------------------------
// Límite de intentos de inicio de sesión (en memoria).
// Permite un máximo de fallos por (correo, IP) dentro de una ventana de 15
// minutos. Suficiente para mitigar fuerza bruta en una red local sin depender
// de la base de datos ni de servicios externos. Al reiniciar el proceso se
// pierde el estado (efecto aceptable para este sistema).
// ---------------------------------------------------------------------------

const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS = 5;
const MAX_ENTRADAS = 5000;

const fallos = new Map(); // `${correo}|${ip}` -> { contar, resetAt }

function clave(correo, ip) {
  return `${correo.toLowerCase()}|${ip}`;
}

/** Descarta ventanas ya vencidas para que el mapa no crezca sin límite. */
function podar() {
  const ahora = Date.now();
  for (const [k, v] of fallos) {
    if (ahora >= v.resetAt) fallos.delete(k);
  }
}

/** True si la combinación correo+IP sobrepasó el máximo de fallos en la ventana. */
export function estaBloqueado(correo, ip) {
  const v = fallos.get(clave(correo, ip));
  return Boolean(v && Date.now() < v.resetAt && v.contar >= MAX_FALLOS);
}

/** Registra un intento fallido (inicia o extiende el contador de la ventana). */
export function registrarFallo(correo, ip) {
  const k = clave(correo, ip);
  const ahora = Date.now();
  const v = fallos.get(k);
  if (!v || ahora >= v.resetAt) {
    fallos.set(k, { contar: 1, resetAt: ahora + VENTANA_MS });
  } else {
    v.contar += 1;
  }
  if (fallos.size >= MAX_ENTRADAS) podar();
}

/** Descarta el historial de fallos tras un login exitoso. */
export function limpiarBloqueo(correo, ip) {
  fallos.delete(clave(correo, ip));
}