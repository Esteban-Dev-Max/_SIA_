import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/acudiente")({
  beforeLoad: () => requireRole("acudiente"),
  component: AcudienteLayout,
});

function AcudienteLayout() {
  return (
    <AuthGate roles={["acudiente"]}>
      <PanelShell title="Panel Acudiente">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
