import { useCallback, useEffect, useRef, useState } from "react";
import {
  agregarPendiente,
  hayRed,
  leerPendientes,
  quitarPendiente,
  sincronizarPendientes,
  type PendienteAsistencia,
} from "@/lib/asistencia-offline";

/**
 * Estado de la asistencia offline: expone la cola pendiente, el estado de red y
 * `encolar`/`sincronizar`. Al recuperar la conexión ([online]) se envía la cola
 * automáticamente; también se expone `sincronizar` para un botón manual.
 */
export function useAsistenciaOffline() {
  const [pendientes, setPendientes] = useState<PendienteAsistencia[]>(leerPendientes);
  const [online, setOnline] = useState<boolean>(() => hayRed());
  const [sincronizando, setSincronizando] = useState(false);
  const bloqueaSincronizacion = useRef(false);

  const refrescar = useCallback(() => setPendientes(leerPendientes()), []);

  const encolar = useCallback(
    (p: Omit<PendienteAsistencia, "encolado_en">) => {
      agregarPendiente(p);
      refrescar();
    },
    [refrescar],
  );

  const quitar = useCallback(
    (grupo_id: number, fecha: string) => {
      quitarPendiente(grupo_id, fecha);
      refrescar();
    },
    [refrescar],
  );

  const sincronizar = useCallback(async () => {
    if (bloqueaSincronizacion.current) return;
    bloqueaSincronizacion.current = true;
    try {
      setSincronizando(true);
      const resultado = await sincronizarPendientes();
      refrescar();
      return resultado;
    } finally {
      setSincronizando(false);
      bloqueaSincronizacion.current = false;
    }
  }, [refrescar]);

  useEffect(() => {
    function irOnline() {
      setOnline(true);
    }
    function irOffline() {
      setOnline(false);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", irOnline);
      window.addEventListener("offline", irOffline);
      return () => {
        window.removeEventListener("online", irOnline);
        window.removeEventListener("offline", irOffline);
      };
    }
  }, []);

  // Flush automático: al montar con red disponible o al volver la conexión.
  useEffect(() => {
    if (!online) return;
    void sincronizar();
  }, [online, sincronizar]);

  return { online, pendientes, sincronizando, encolar, quitar, sincronizar, refrescar };
}
