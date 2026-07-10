import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GraduationCap, Users, BookOpen, ClipboardCheck, ArrowRight, Sparkles, Shield, Zap, Star, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const u = getUser();
    if (u) throw redirect({ to: `/${u.rol}` as "/admin" | "/profesor" | "/estudiante" });
  },
  component: Home,
});

const features = [
  {
    icon: Users,
    title: "Gestión de usuarios",
    desc: "Administra estudiantes, profesores y roles desde un solo lugar con control total.",
    accent: "from-violet-500 to-purple-600",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-500/10",
  },
  {
    icon: BookOpen,
    title: "Carreras y materias",
    desc: "Organiza el plan académico con carreras, materias y matrículas de forma intuitiva.",
    accent: "from-emerald-500 to-teal-600",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    icon: ClipboardCheck,
    title: "Notas y asistencia",
    desc: "Registra calificaciones y control de asistencia en tiempo real con un solo clic.",
    accent: "from-amber-500 to-orange-600",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
  },
];

const stats = [
  { value: "3", label: "Roles", desc: "Admin, Profesor, Estudiante" },
  { value: "99%", label: "Uptime", desc: "Siempre disponible" },
  { value: "0", label: "Configuración", desc: "Zero setup requerido" },
];

function Home() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-lg shadow-primary/20">
              <GraduationCap className="h-5 w-5" />
            </div>
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
            <Button size="sm" asChild className="rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300">
              <Link to="/login" className="gap-1.5">
                Comenzar
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="mesh-bg-intense absolute inset-0" />
          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary animate-in">
                <Sparkles className="h-3.5 w-3.5" />
                SIA — Sistema Integral Académico y Profesional
              </div>
              <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-display animate-in-up stagger-1">
                Gestiona tu institución{" "}
                <span className="gradient-text">
                  académica y profesional
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground animate-in-up stagger-2">
                SIA centraliza estudiantes, profesores, materias, notas y asistencia
                en una sola plataforma moderna y fácil de usar.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-in-up stagger-3">
                <Button size="lg" asChild className="gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 h-12 px-6">
                  <Link to="/login">
                    Comenzar ahora
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="rounded-xl h-12 px-6 border-border/60">
                  <a href="#demo">
                    Ver demo
                    <ChevronRight className="h-4 w-4 ml-1" />
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

        {/* Features Section */}
        <section className="relative border-t border-border/40 bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium border-primary/20 bg-primary/5 text-primary">
                <Zap className="h-3 w-3 mr-1" />
                Todo lo que necesitas
              </Badge>
              <h2 className="text-3xl font-bold font-display sm:text-4xl">
                Una plataforma,{" "}
                <span className="gradient-text-simple">infinitas posibilidades</span>
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Herramientas diseñadas para cada rol dentro de tu institución educativa.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {features.map(({ icon: Icon, title, desc, accent, color, bg }, i) => (
                <div
                  key={title}
                  className="group relative overflow-hidden rounded-2xl border border-border/50 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className={cn(
                    "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                    "bg-gradient-to-br from-transparent via-transparent to-muted/10"
                  )} />
                  <div className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm",
                    bg, color
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold font-display">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  <div className={cn(
                    "absolute -bottom-6 -right-6 h-20 w-20 rounded-full opacity-0 transition-all duration-500 group-hover:scale-150 group-hover:opacity-10",
                    `bg-gradient-to-br ${accent}`
                  )} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="relative border-t border-border/40 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium border-primary/20 bg-primary/5 text-primary">
                <Shield className="h-3 w-3 mr-1" />
                Cuentas demo
              </Badge>
              <h2 className="text-3xl font-bold font-display sm:text-4xl">
                Prueba SIA <span className="gradient-text-simple">gratis ahora</span>
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Usa cualquiera de las siguientes cuentas de demostración para explorar los tres roles.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { rol: "Administrador", email: "admin@demo.com", pass: "admin123", color: "from-violet-500 to-purple-600" },
                { rol: "Profesor", email: "profe@demo.com", pass: "profe123", color: "from-emerald-500 to-teal-600" },
                { rol: "Estudiante", email: "alumno@demo.com", pass: "alumno123", color: "from-amber-500 to-orange-600" },
              ].map((d) => (
                <div key={d.email} className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm">
                  <div className={cn("mb-3 inline-flex rounded-lg bg-gradient-to-br px-3 py-1 text-xs font-semibold text-white", d.color)}>
                    {d.rol}
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <p><span className="text-muted-foreground">Email:</span> <span className="font-mono font-medium">{d.email}</span></p>
                    <p><span className="text-muted-foreground">Clave:</span> <span className="font-mono font-medium">{d.pass}</span></p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button size="lg" asChild className="gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/25 h-12 px-6">
                <Link to="/login">
                  Entrar con cuenta demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative border-t border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-purple-700 px-6 py-12 text-center shadow-2xl sm:px-12 sm:py-16">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
              <div className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Star className="h-7 w-7 text-white" />
                </div>
                <h2 className="mt-5 text-3xl font-bold text-white font-display sm:text-4xl">
                  ¿Listo para empezar con SIA?
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
                  Únete al Sistema Integral Académico y Profesional. Sin configuraciones complejas, solo resultados.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button size="lg" asChild className="gap-2 rounded-xl bg-white text-primary hover:bg-white/90 shadow-xl h-12 px-6">
                    <Link to="/login">
                      Acceder ahora
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" asChild className="gap-2 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:text-white backdrop-blur-sm h-12 px-6">
                    <a href="#demo">
                      <Shield className="h-4 w-4 mr-1.5" />
                      Demo gratuita
                    </a>
                  </Button>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 text-white">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold font-display">SIA</span>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} SIA — Sistema Integral Académico y Profesional. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
