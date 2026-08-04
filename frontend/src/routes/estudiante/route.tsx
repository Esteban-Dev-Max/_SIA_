import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell, type NavItem } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { LayoutDashboard, ClipboardList, CalendarDays, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/estudiante")({
  beforeLoad: () => requireRole("estudiante"),
  component: EstudianteLayout,
});

const nav: NavItem[] = [
  { label: "Panel", to: "/estudiante", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Tareas", to: "/estudiante/tareas", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Mensajes", to: "/mensajes", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Calendario", to: "/calendario", icon: <CalendarDays className="h-4 w-4" /> },
];

function EstudianteLayout() {
  return (
    <AuthGate roles={["estudiante"]}>
      <PanelShell title="Panel Estudiante" nav={nav}>
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
