import { api } from "@/lib/api";
import type { EstadoAsistencia } from "@/lib/asistencia";

// Cola de asistencia offline: cuando un profesor marca sin conexión, el envío al
// backend se guarda en localStorage y se sincroniza al recuperar la red (coloneta
// "asistencia offline" estilo Nargar). Se dispara [online], o manualmente con
// `sincronizarPendientes`.

export type RegistroPendiente = {
  matricula_id: number;
  estado: EstadoAsistencia;
  observacion: string | null;
};

export type PendienteAsistencia = {
  grupo_id: number;
  fecha: string;
  justificacion?: string | null;
  registros: RegistroPendiente[];
  encolado_en: string;
};

const CLAVE = "sia_asistencia_pendientes";

export function leerPendientes(): PendienteAsistencia[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as PendienteAsistencia[]) : [];
  } catch {
    return [];
  }
}

function guardar(lista: PendienteAsistencia[]) {
  try {
    if (lista.length === 0) window.localStorage.removeItem(CLAVE);
    else window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Cuota llena o almacenamiento no disponible: se descarta silenciosamente,
    // el profesor igualmente ve el error en la UI y puede reintentar online.
  }
}

/** Encola o reemplaza la pendiente de un (grupo, fecha): la más reciente gana. */
export function agregarPendiente(p: PendienteAsistencia): PendienteAsistencia[] {
  const lista = leerPendientes().filter((x) => !(x.grupo_id === p.grupo_id && x.fecha === p.fecha));
  const nueva = [...lista, { ...p, encolado_en: new Date().toISOString() }];
  guardar(nueva);
  return nueva;
}

export function quitarPendiente(grupo_id: number, fecha: string): PendienteAsistencia[] {
  const lista = leerPendientes().filter((x) => !(x.grupo_id === grupo_id && x.fecha === fecha));
  guardar(lista);
  return lista;
}

export function contarPendientes(): number {
  return leerPendientes().length;
}

export function hayRed(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Intenta enviar toda la cola pendiente al backend. Devuelve cuántos paquetes
 * (grupo+fecha) subieron y cuántos fallaron. Los exitosos se quitan de la cola;
 * ante el primer error se detiene el resto (se reintenta en el próximo flush).
 */
export async function sincronizarPendientes(): Promise<{ subidos: number; fallidos: number }> {
  const pendientes = leerPendientes();
  let subidos = 0;
  let fallidos = 0;
  for (const p of pendientes) {
    try {
      await api("/api/asistencia/registrar", {
        method: "POST",
        body: JSON.stringify({
          grupo_id: p.grupo_id,
          fecha: p.fecha,
          ...(p.justificacion ? { justificacion: p.justificacion } : {}),
          registros: p.registros,
        }),
      });
      quitarPendiente(p.grupo_id, p.fecha);
      subidos += 1;
    } catch {
      fallidos += 1;
      break;
    }
  }
  return { subidos, fallidos };
}
