import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";
import { PanelShell, type NavItem } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { LayoutDashboard, CalendarDays, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/acudiente")({
  beforeLoad: () => requireRole("acudiente"),
  component: AcudienteLayout,
});

const nav: NavItem[] = [
  { label: "Panel", to: "/acudiente", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Mensajes", to: "/mensajes", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Calendario", to: "/calendario", icon: <CalendarDays className="h-4 w-4" /> },
];

function AcudienteLayout() {
  return (
    <AuthGate roles={["acudiente"]}>
      <PanelShell title="Panel Acudiente" nav={nav}>
        <Outlet />
      </PanelShell>
    </AuthGate>
  );
}
