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

// ---------------------------------------------------------------------------
// Límite de peticiones por usuario+IP (ventana fija, en memoria).
// Protege endpoints de uso intensivo (p. ej. el chatbot con IA) del abuso:
// un mismo usuario no puede disparar cientos de llamadas que quemen la cuota
// de Gemini o saturen la BD. El estado se pierde al reiniciar el proceso.
// ---------------------------------------------------------------------------
const peticiones = new Map(); // `${usuarioId}|${ip}` -> { contar, resetAt }
const MAX_ENTRADAS_PETICIONES = 10000;

function clavePeticion(usuarioId, ip) {
  return `${usuarioId}|${ip}`;
}

/**
 * Devuelve un middleware que limita a `maxPorVentana` peticiones por
 * `ventanaMs`. Requiere que `verifyToken` ya haya corrido (usa `req.user.id`).
 */
export function crearLimitePeticiones({
  ventanaMs = 60 * 1000,
  maxPorVentana = 15,
} = {}) {
  return (req, res, next) => {
    const key = clavePeticion(
      req.user?.id ?? "anon",
      req.ip || req.socket.remoteAddress || "unknown",
    );
    const ahora = Date.now();
    const v = peticiones.get(key);
    if (!v || ahora >= v.resetAt) {
      peticiones.set(key, { contar: 1, resetAt: ahora + ventanaMs });
      return next();
    }
    v.contar += 1;
    if (v.contar > maxPorVentana) {
      return res.status(429).json({
        error:
          "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }
    if (peticiones.size >= MAX_ENTRADAS_PETICIONES) {
      for (const [k, x] of peticiones) {
        if (ahora >= x.resetAt) peticiones.delete(k);
      }
    }
    next();
  };
}