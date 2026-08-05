import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/estudiante")({
  beforeLoad: () => requireRole("estudiante"),
  component: EstudianteLayout,
});

function EstudianteLayout() {
  return (
    <AuthGate roles={["estudiante"]}>
      <PanelShell title="Panel Estudiante">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
