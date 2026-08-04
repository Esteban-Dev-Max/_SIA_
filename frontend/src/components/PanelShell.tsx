import { useNavigate, Link } from "@tanstack/react-router";
import { clearSession, getUser, type Rol } from "@/lib/api";
import type { ReactNode } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import {
  GraduationCap,
  LogOut,
  LayoutDashboard,
  User,
  ChevronDown,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NavItem = { label: string; to: string; icon?: ReactNode };

const rolLabels: Record<Rol, string> = {
  admin: "Administrador",
  profesor: "Profesor",
  estudiante: "Estudiante",
  acudiente: "Acudiente",
};

const rolColors: Record<Rol, string> = {
  admin: "bg-violet-500/10 text-violet-700 border-violet-200",
  profesor: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  estudiante: "bg-primary/10 text-primary border-primary/20",
  acudiente: "bg-sky-500/10 text-sky-700 border-sky-200",
};

const rolIcons: Record<Rol, ReactNode> = {
  admin: <LayoutDashboard className="h-4 w-4" />,
  profesor: <User className="h-4 w-4" />,
  estudiante: <GraduationCap className="h-4 w-4" />,
  acudiente: <HeartHandshake className="h-4 w-4" />,
};

export function PanelShell({
  title,
  children,
  nav,
}: {
  title: string;
  children: ReactNode;
  nav?: NavItem[];
}) {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    clearSession();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen mesh-bg">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="SIA" className="h-10 w-auto object-contain" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  SIA
                </p>
                <h1 className="text-sm font-bold leading-tight sm:text-base">{title}</h1>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-accent/50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-violet-500/10 text-primary">
                    {user?.rol && rolIcons[user.rol]}
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold leading-tight">{user?.nombre}</p>
                    {user?.rol && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-0.5 text-[10px] font-normal px-1.5 py-0",
                          rolColors[user.rol],
                        )}
                      >
                        {rolLabels[user.rol]}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/60 p-1.5">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  {user?.correo}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                  onClick={logout}
                  className="gap-2.5 rounded-lg px-2 py-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-in">
        {nav && nav.length > 0 && (
          <nav className="mb-6 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-white/70 p-1.5 shadow-sm backdrop-blur">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to as never}
                activeOptions={{ exact: true }}
                activeProps={{
                  className:
                    "bg-foreground text-background hover:bg-foreground hover:text-background",
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
