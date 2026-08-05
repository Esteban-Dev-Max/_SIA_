import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  GraduationCap,
  HeartHandshake,
  BookOpen,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const u = getUser();
    if (u)
      throw redirect({ to: `/${u.rol}` as "/admin" | "/profesor" | "/estudiante" | "/acudiente" });
  },
  component: Home,
});

const features = [
  {
    icon: BarChart3,
    title: "Calificaciones Automatizadas",
    desc: "Cálculo automático de definitivas con la ponderación 25/25/20/30 y control de notas en tiempo real.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    icon: CalendarDays,
    title: "Calendario Unificado",
    desc: "Eventos, fechas de entrega y reuniones en un solo lugar, visibles para toda la comunidad.",
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    accent: "from-sky-500 to-indigo-600",
  },
  {
    icon: Bot,
    title: "Asistente IA",
    desc: "Chatbot integrado que resuelve dudas académicas con respuestas personalizadas por rol.",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    accent: "from-violet-500 to-purple-600",
  },
  {
    icon: BellRing,
    title: "Notificaciones en Tiempo Real",
    desc: "Alertas de sistema, tareas, notas y mensajes al instante para no perderte nada.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    accent: "from-amber-500 to-orange-600",
  },
];

const roles = [
  {
    icon: Crown,
    rol: "Administrador",
    desc: "Control total de usuarios, matrículas y métricas de la institución.",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    bullets: [
      "Gestión de usuarios y roles",
      "Carreras, materias y matrículas",
      "Estadísticas del dashboard",
    ],
  },
  {
    icon: GraduationCap,
    rol: "Profesor",
    desc: "Gestión rápida de notas, asistencia y revisión de entregas.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    bullets: ["Planilla de calificaciones", "Asistencia diaria", "Tareas y revisión de entregas"],
  },
  {
    icon: BookOpen,
    rol: "Estudiante",
    desc: "Seguimiento de su rendimiento, tareas y calendario académico.",
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    bullets: ["Notas, promedio y asistencia", "Entregas de tareas", "Chatbot Asistente SIA"],
  },
  {
    icon: HeartHandshake,
    rol: "Acudiente",
    desc: "Monitoreo en tiempo real del progreso de sus acudidos.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    bullets: ["Rendimiento de sus estudiantes", "Alertas de inasistencia", "Boletín imprimible"],
  },
];

const stats = [
  {
    value: "4",
    label: "Roles y paneles",
    desc: "Admin, profesor, estudiante y acudiente",
  },
  {
    value: "25/25/20/30",
    label: "Ponderación de notas",
    desc: "Definitivas calculadas automáticamente",
  },
  {
    value: "100%",
    label: "Datos en tiempo real",
    desc: "Notas, asistencia y mensajes al instante",
  },
];

const cuentasDemo = [
  ["Admin", "admin@sia.edu.co"],
  ["Profesor", "profesor@sia.edu.co"],
  ["Estudiante", "estudiante@sia.edu.co"],
  ["Acudiente", "acudiente@sia.edu.co"],
];

function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const u = getUser();
    if (u) {
      navigate({ to: `/${u.rol}` as "/admin" | "/profesor" | "/estudiante" | "/acudiente" });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SIA" className="h-9 w-auto object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold font-display">SIA</span>
              <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Sistema Integral Académico
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex rounded-xl">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
            >
              <Link to="/login" className="gap-1.5">
                Comenzar
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mesh-bg-intense absolute inset-0" />
          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary animate-in">
                <Sparkles className="h-3.5 w-3.5" />
                SIA — Sistema Integral Académico
              </div>
              <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-display animate-in-up stagger-1">
                Sistema <span className="gradient-text">Integral Académico</span> (SIA)
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground animate-in-up stagger-2">
                Centraliza la gestión de notas, asistencia, tareas y comunicaciones en una
                plataforma moderna y accesible para toda la comunidad educativa.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-in-up stagger-3">
                <Button
                  size="lg"
                  asChild
                  className="gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 h-12 px-6"
                >
                  <Link to="/login">
                    Iniciar Sesión
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="rounded-xl h-12 px-6 border-border/60"
                >
                  <a href="#caracteristicas">
                    Conoce más
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3 animate-in-up stagger-4">
              {stats.map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-6 text-center">
                  <p className="text-3xl font-bold font-display gradient-text-simple">{s.value}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{s.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="caracteristicas"
          className="relative scroll-mt-24 border-t border-border/40 bg-muted/20"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="text-center">
              <Badge
                variant="outline"
                className="mb-4 px-3 py-1 text-xs font-medium border-primary/20 bg-primary/5 text-primary"
              >
                <Zap className="h-3 w-3 mr-1" />
                Funciones estrella
              </Badge>
              <h2 className="text-3xl font-bold font-display sm:text-4xl">
                Todo lo que tu institución{" "}
                <span className="gradient-text-simple">necesita en un solo lugar</span>
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Herramientas modernas diseñadas para automatizar la gestión académica del día a día.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, desc, color, bg, accent }) => (
                <div
                  key={title}
                  className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  <div
                    className={cn(
                      "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                      "bg-gradient-to-br from-transparent via-transparent to-muted/10",
                    )}
                  />
                  <div
                    className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm",
                      bg,
                      color,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold font-display">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  <div
                    className={cn(
                      "absolute -bottom-6 -right-6 h-20 w-20 rounded-full opacity-0 transition-all duration-500 group-hover:scale-150 group-hover:opacity-10",
                      `bg-gradient-to-br ${accent}`,
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="relative border-t border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="text-center">
              <Badge
                variant="outline"
                className="mb-4 px-3 py-1 text-xs font-medium border-primary/20 bg-primary/5 text-primary"
              >
                <Users className="h-3 w-3 mr-1" />
                Comunidad educativa
              </Badge>
              <h2 className="text-3xl font-bold font-display sm:text-4xl">
                Paneles especializados para <span className="gradient-text-simple">cada rol</span>
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Cada miembro de la comunidad tiene su propio espacio, diseñado para su día a día.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {roles.map(({ icon: Icon, rol, desc, color, bg, bullets }) => (
                <div
                  key={rol}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  <div
                    className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm",
                      bg,
                      color,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold font-display">{rol}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  <ul className="mt-4 space-y-2 border-t border-border/40 pt-4">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative border-t border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-purple-700 px-6 py-12 text-center shadow-2xl sm:px-12 sm:py-16">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5kb2QiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
              <div className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <h2 className="mt-5 text-3xl font-bold text-white font-display sm:text-4xl">
                  ¿Listo para empezar con SIA?
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
                  Únete al Sistema Integral Académico. Sin configuraciones complejas, solo
                  resultados.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="lg"
                    asChild
                    className="gap-2 rounded-xl bg-white text-primary hover:bg-white/90 shadow-xl h-12 px-6"
                  >
                    <Link to="/login">
                      Iniciar Sesión
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    asChild
                    className="gap-2 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:text-white backdrop-blur-sm h-12 px-6"
                  >
                    <a href="#caracteristicas">
                      <ChevronDown className="h-4 w-4 mr-1.5" />
                      Conoce más
                    </a>
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  {cuentasDemo.map(([rol, correo]) => (
                    <span
                      key={rol}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-sm"
                    >
                      {rol}: {correo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="SIA" className="h-8 w-auto object-contain" />
              <span className="text-sm font-bold font-display">SIA</span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 SIA — Sistema Integral Académico. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
