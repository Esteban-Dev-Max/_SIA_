import { redirect } from "@tanstack/react-router";
import { getUser, type Rol } from "./api";

export function requireRole(rol: Rol) {
  if (typeof window === "undefined") return;
  const u = getUser();
  if (!u) throw redirect({ to: "/login" });
  if (u.rol !== rol) throw redirect({ to: `/${u.rol}` as "/admin" | "/profesor" | "/estudiante" });
}
