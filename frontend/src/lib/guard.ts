import { redirect } from "@tanstack/react-router";
import { getUser, type Rol } from "./api";

const dashboards: Record<Rol, string> = {
  admin: "/admin",
  profesor: "/profesor",
  estudiante: "/estudiante",
  acudiente: "/acudiente",
};

/** Protege una ruta: exige sesión activa y que el rol coincida con los permitidos. */
export function requireRole(...roles: Rol[]) {
  if (typeof window === "undefined") return;
  const u = getUser();
  if (!u) throw redirect({ to: "/login" });
  if (!roles.includes(u.rol)) {
    throw redirect({
      to: dashboards[u.rol] as "/admin" | "/profesor" | "/estudiante" | "/acudiente",
    });
  }
}
