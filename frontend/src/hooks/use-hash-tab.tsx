import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Sincroniza un Tabs de shadcn con el hash de la URL (ej: /profesor#asistencia).
 * Permite que el menú lateral enlace a una pestaña concreta de la página.
 * `options` debe ser un array estable (definido a nivel de módulo) para no resetear la pestaña.
 */
export function useHashTab<V extends string>(
  options: readonly V[],
  fallback: V,
): [V, (value: V) => void] {
  const location = useLocation();
  const hash = location.hash as V;
  // Se inicializa con `fallback` (valor del SSR): el hash solo se aplica tras el
  // montaje para no romper la hidratación al recargar una URL con #pestaña.
  const [tab, setTab] = useState<V>(fallback);

  useEffect(() => {
    if (hash && options.includes(hash)) setTab(hash);
    else setTab(fallback);
  }, [hash, options, fallback]);

  function onChange(value: V) {
    setTab(value);
    window.history.replaceState(null, "", `${location.pathname}#${value}`);
  }

  return [tab, onChange];
}
