import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getUser, type Rol } from "@/lib/api";
import { Loader2 } from "lucide-react";

const dashboards: Record<Rol, string> = {
  admin: "/admin",
  profesor: "/profesor",
  estudiante: "/estudiante",
  acudiente: "/acudiente",
};

/**
 * Verifica la sesión en el cliente (la hidratación no re-ejecuta beforeLoad).
 * Sin sesión redirige a /login; con rol no permitido, al dashboard del usuario.
 */
export function AuthGate({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/login" });
      return;
    }
    if (!roles.includes(u.rol)) {
      navigate({
        to: dashboards[u.rol] as "/admin" | "/profesor" | "/estudiante" | "/acudiente",
      });
      return;
    }
    setOk(true);
  }, [navigate, roles]);

  if (!ok) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return children;
}
