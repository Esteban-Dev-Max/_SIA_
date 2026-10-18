import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { clearSession, getUser, api, urlRecurso, type AuthUser, type Rol } from "@/lib/api";
import { useEffect, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Layers,
  LogOut,
  MessageSquare,
  School,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  hash?: string;
  icon: ReactNode;
};

const generalNav: NavItem[] = [
  { label: "Calendario", to: "/calendario", icon: <CalendarDays className="h-4 w-4" /> },
  { label: "Mensajes", to: "/mensajes", icon: <MessageSquare className="h-4 w-4" /> },
];

const roleNav: Record<Rol, { label: string; items: NavItem[] }[]> = {
  superadmin: [
    {
      label: "Plataforma",
      items: [
        {
          label: "Instituciones",
          to: "/admin/instituciones",
          icon: <School className="h-4 w-4" />,
        },
      ],
    },
  ],
  admin: [
    {
      label: "Administración",
      items: [
        { label: "Inicio", to: "/admin", icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: "Usuarios", to: "/admin/usuarios", icon: <Users className="h-4 w-4" /> },
        {
          label: "Grados",
          to: "/admin/academico",
          hash: "grados",
          icon: <School className="h-4 w-4" />,
        },
        {
          label: "Asignaturas",
          to: "/admin/academico",
          hash: "asignaturas",
          icon: <BookOpen className="h-4 w-4" />,
        },
        {
          label: "Cursos",
          to: "/admin/academico",
          hash: "cursos",
          icon: <Layers className="h-4 w-4" />,
        },
        {
          label: "Asignaciones",
          to: "/admin/academico",
          hash: "asignaciones",
          icon: <ClipboardCheck className="h-4 w-4" />,
        },
        {
          label: "Matrículas",
          to: "/admin/academico",
          hash: "matriculas",
          icon: <ClipboardList className="h-4 w-4" />,
        },
        {
          label: "Vincular acudiente",
          to: "/admin/academico",
          hash: "acudientes",
          icon: <HeartHandshake className="h-4 w-4" />,
        },
        {
          label: "Asistencia",
          to: "/admin/asistencia",
          icon: <CalendarCheck className="h-4 w-4" />,
        },
      ],
    },
    { label: "General", items: generalNav },
  ],
  profesor: [
    {
      label: "Docencia",
      items: [
        { label: "Inicio", to: "/profesor", icon: <LayoutDashboard className="h-4 w-4" /> },
        {
          label: "Planilla Notas",
          to: "/profesor",
          hash: "planilla",
          icon: <ClipboardCheck className="h-4 w-4" />,
        },
        {
          label: "Asistencia",
          to: "/profesor",
          hash: "asistencia",
          icon: <CalendarCheck className="h-4 w-4" />,
        },
        { label: "Tareas", to: "/profesor/tareas", icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
    { label: "General", items: generalNav },
  ],
  estudiante: [
    {
      label: "Mi aprendizaje",
      items: [
        { label: "Inicio", to: "/estudiante", icon: <LayoutDashboard className="h-4 w-4" /> },
        {
          label: "Mis Notas",
          to: "/estudiante",
          hash: "notas",
          icon: <GraduationCap className="h-4 w-4" />,
        },
        {
          label: "Asistencia",
          to: "/estudiante",
          hash: "asistencia",
          icon: <CalendarCheck className="h-4 w-4" />,
        },
        {
          label: "Entregas",
          to: "/estudiante/tareas",
          icon: <ClipboardList className="h-4 w-4" />,
        },
      ],
    },
    { label: "Herramientas", items: generalNav },
  ],
  acudiente: [
    {
      label: "Seguimiento",
      items: [
        { label: "Inicio", to: "/acudiente", icon: <LayoutDashboard className="h-4 w-4" /> },
        {
          label: "Resumen",
          to: "/acudiente",
          hash: "resumen",
          icon: <BarChart3 className="h-4 w-4" />,
        },
      ],
    },
    { label: "General", items: generalNav },
  ],
};

const rolLabels: Record<Rol, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  profesor: "Docente",
  estudiante: "Estudiante",
  acudiente: "Acudiente",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [alertaInactiva, setAlertaInactiva] = useState(false);

  // La sesión vive en localStorage: se carga tras el montaje para que el SSR y el
  // primer render del cliente coincidan (evita errores de hidratación que congelan la UI).
  useEffect(() => {
    setUser(getUser());
  }, []);

  // Detecta de forma fresca si la institución del usuario fue desactivada por el
  // superadministrador (no se puede confiar solo en el estado guardado al iniciar
  // sesión, que quedaría obsoleto). Solo aplica a cuentas con institución (admin).
  useEffect(() => {
    const u = getUser();
    if (!u || u.rol !== "admin") return;
    api<AuthUser>("/api/auth/me")
      .then((me) => {
        if (me.institucion_estado === "inactivo") setAlertaInactiva(true);
      })
      .catch(() => undefined);
  }, []);

  function logout() {
    clearSession();
    navigate({ to: "/login" });
  }

  const groups = user ? roleNav[user.rol] : [];
  const pathname = location.pathname;
  const hash = location.hash;

  function isActive(item: NavItem): boolean {
    const samePath = pathname === item.to;
    if (item.hash) return samePath && hash === item.hash;
    return samePath && hash === "";
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                asChild
                className="gap-2.5 px-2 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
              >
                <Link to="/" className="min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 shadow-sm">
                    <img src="/logo.png" alt="SIA" className="h-6 w-6 object-contain" />
                  </div>
                  <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="font-display text-sm font-bold tracking-tight">SIA</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Académico
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="scrollbar-thin">
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={`${item.label}-${item.hash ?? ""}`}>
                    <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                      <Link to={item.to as never} hash={item.hash}>
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="mesh-bg">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6">
          <SidebarTrigger className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent/50" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-sm font-bold leading-tight tracking-tight sm:text-base">
              {title}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {user?.institucion_logo && (
              <div className="flex items-center gap-2.5">
                <img
                  src={urlRecurso(user.institucion_logo)}
                  alt={user?.institucion_nombre || "Institución"}
                  className="h-12 w-auto object-contain"
                  title={user?.institucion_nombre || "Institución"}
                />
                {user?.institucion_nombre && (
                  <span className="hidden font-display text-sm font-bold tracking-tight lg:block">
                    {user?.institucion_nombre}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent/50 sm:pl-2.5"
                  >
                    <Avatar className="size-8 rounded-lg border border-border/60">
                      {user?.foto_url ? (
                        <AvatarImage src={urlRecurso(user.foto_url)} alt={user.nombre} />
                      ) : (
                        <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/15 text-primary text-xs font-bold">
                          {user ? initials(user.nombre) : "U"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <p className="max-w-[10rem] truncate text-sm font-semibold leading-tight">
                        {user?.nombre}
                      </p>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {user?.rol ? rolLabels[user.rol] : ""}
                      </p>
                    </div>
                    <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-xl border-border/60 p-1.5">
                  <DropdownMenuLabel className="px-2 py-1.5">
                    <p className="text-sm font-semibold">{user?.nombre}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {user?.correo}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem asChild className="gap-2.5 rounded-lg px-2 py-2 cursor-pointer">
                    <Link to="/configuracion">
                      <Settings className="size-4" />
                      <span>Configuración</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem
                    onClick={logout}
                    className="gap-2.5 rounded-lg px-2 py-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </SidebarInset>

      <AlertDialog open={alertaInactiva} onOpenChange={setAlertaInactiva}>
        <AlertDialogContent className="max-w-md rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Institución desactivada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Tu institución fue desactivada por el superadministrador. En este momento los accesos
              están restringidos. Si crees que es un error, contacta con el soporte de la
              plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertaInactiva(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
