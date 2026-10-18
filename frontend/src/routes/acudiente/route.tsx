import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import type { Rol } from "@/lib/api";

const ROLES: Rol[] = ["acudiente"];

export const Route = createFileRoute("/acudiente")({
  beforeLoad: () => requireRole("acudiente"),
  component: AcudienteLayout,
});

function AcudienteLayout() {
  return (
    <AuthGate roles={ROLES}>
      <PanelShell title="Panel Acudiente">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
