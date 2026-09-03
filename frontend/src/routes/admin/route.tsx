import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { getUser } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireRole("admin", "superadmin"),
  component: AdminLayout,
});

function AdminLayout() {
  const esSuperAdmin = getUser()?.rol === "superadmin";
  return (
    <AuthGate roles={["admin", "superadmin"]}>
      <PanelShell title={esSuperAdmin ? "Panel Super Admin" : "Panel Administrador"}>
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
