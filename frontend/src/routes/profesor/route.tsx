import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/profesor")({
  beforeLoad: () => requireRole("profesor"),
  component: ProfesorLayout,
});

function ProfesorLayout() {
  return (
    <AuthGate roles={["profesor"]}>
      <PanelShell title="Panel Docente">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
