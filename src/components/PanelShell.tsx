import { useNavigate } from "@tanstack/react-router";
import { clearSession, getUser } from "@/lib/api";
import type { ReactNode } from "react";

export function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    clearSession();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {user?.nombre} · <span className="capitalize">{user?.rol}</span>
            </span>
            <button
              onClick={logout}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
