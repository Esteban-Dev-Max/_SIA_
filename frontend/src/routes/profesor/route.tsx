import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import type { Rol } from "@/lib/api";

const ROLES: Rol[] = ["profesor"];

export const Route = createFileRoute("/profesor")({
  beforeLoad: () => requireRole("profesor"),
  component: ProfesorLayout,
});

function ProfesorLayout() {
  return (
    <AuthGate roles={ROLES}>
      <PanelShell title="Panel Docente">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
