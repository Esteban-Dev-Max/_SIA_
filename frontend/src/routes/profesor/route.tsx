import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell, type NavItem } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { LayoutDashboard, ClipboardList, CalendarDays, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/profesor")({
  beforeLoad: () => requireRole("profesor"),
  component: ProfesorLayout,
});

const nav: NavItem[] = [
  { label: "Panel", to: "/profesor", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Tareas", to: "/profesor/tareas", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Mensajes", to: "/mensajes", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Calendario", to: "/calendario", icon: <CalendarDays className="h-4 w-4" /> },
];

function ProfesorLayout() {
  return (
    <AuthGate roles={["profesor"]}>
      <PanelShell title="Panel Profesor" nav={nav}>
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
