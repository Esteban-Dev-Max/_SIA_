import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireRole("admin"),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthGate roles={["admin"]}>
      <PanelShell title="Panel Administrador">
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
