import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getUser } from "@/lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const u = getUser();
    if (u) throw redirect({ to: `/${u.rol}` as "/admin" | "/profesor" | "/estudiante" });
  },
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground">Sistema Académico</h1>
        <p className="mt-2 text-muted-foreground">
          Gestión de estudiantes, profesores, notas y asistencia.
        </p>
      </div>
      <Link
        to="/login"
        className="inline-flex items-center rounded-md bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
      >
        Iniciar sesión
      </Link>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        Requiere que el backend Express esté corriendo en{" "}
        <code className="rounded bg-muted px-1">http://localhost:3001</code>. Consulta{" "}
        <code>server/README.md</code>.
      </p>
    </div>
  );
}
