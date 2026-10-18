import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import type { Rol } from "@/lib/api";

const ROLES: Rol[] = ["estudiante"];

export const Route = createFileRoute("/estudiante")({
  beforeLoad: () => requireRole("estudiante"),
  component: EstudianteLayout,
});

function EstudianteLayout() {
  return (
    <AuthGate roles={ROLES}>
      <PanelShell title="Panel Estudiante">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
