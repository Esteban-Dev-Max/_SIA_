import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell, type NavItem } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { LayoutDashboard, Users, BookOpen, CalendarDays, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireRole("admin"),
  component: AdminLayout,
});

const nav: NavItem[] = [
  { label: "Panel", to: "/admin", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Usuarios", to: "/admin/usuarios", icon: <Users className="h-4 w-4" /> },
  { label: "Académico", to: "/admin/academico", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Mensajes", to: "/mensajes", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Calendario", to: "/calendario", icon: <CalendarDays className="h-4 w-4" /> },
];

function AdminLayout() {
  return (
    <AuthGate roles={["admin"]}>
      <PanelShell title="Panel Administrador" nav={nav}>
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
