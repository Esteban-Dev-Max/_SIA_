import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, setSession, type AuthUser, type Rol } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  User,
  ShieldCheck,
  HeartHandshake,
  Crown,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const dashboards: Record<Rol, string> = {
  superadmin: "/admin/instituciones",
  admin: "/admin",
  profesor: "/profesor",
  estudiante: "/estudiante",
  acudiente: "/acudiente",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const demoAccounts = [
  {
    rol: "Super Admin",
    email: "superadmin@sia.edu.co",
    pass: "superadmin123",
    icon: Crown,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10",
  },
  {
    rol: "Admin",
    email: "admin@sia.edu.co",
    pass: "admin123",
    icon: ShieldCheck,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-500/10",
  },
  {
    rol: "Profesor",
    email: "profesor@sia.edu.co",
    pass: "prof123",
    icon: User,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    rol: "Estudiante",
    email: "estudiante@sia.edu.co",
    pass: "est123",
    icon: GraduationCap,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-500/10",
  },
  {
    rol: "Acudiente",
    email: "acudiente@sia.edu.co",
    pass: "acu123",
    icon: HeartHandshake,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-500/10",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      toast.error("Ingresa un correo electrónico válido");
      return;
    }
    if (!password) {
      toast.error("Ingresa tu contraseña");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ correo: email, password }),
      });
      setSession(data.token, data.user, remember);
      toast.success(`¡Bienvenido, ${data.user.nombre}!`);
      navigate({
        to: dashboards[data.user.rol] as "/admin" | "/profesor" | "/estudiante" | "/acudiente",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="relative hidden w-1/2 flex-col overflow-hidden lg:flex">
        <div className="mesh-bg-intense absolute inset-0" />
        <div className="relative flex flex-1 flex-col justify-between p-10">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SIA" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold font-display">SIA</span>
          </Link>

          <div className="mx-auto max-w-md">
            <div className="glass-card rounded-3xl p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 shadow-sm">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mt-5 text-2xl font-bold font-display">Tu plataforma académica</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Centralizada, segura y diseñada para simplificar la gestión educativa. Accede según
                tu rol y comienza a trabajar.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {["Admin", "Profesor", "Estudiante", "Acudiente"].map((role) => (
                  <div key={role} className="rounded-xl bg-muted/30 p-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {role}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SIA</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="mesh-bg flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-in">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <Card className="w-full border-border/50 shadow-xl rounded-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-purple-600" />
            <CardHeader className="space-y-1 pb-4 pt-6">
              <div className="mb-2 flex h-11 w-11 items-center justify-center lg:hidden">
                <img src="/logo.png" alt="SIA" className="h-11 w-auto object-contain" />
              </div>
              <CardTitle className="text-2xl font-display">Iniciar sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para acceder al sistema</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 rounded-xl border-border/60 focus-visible:ring-primary/30"
                      placeholder="tu@correo.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-xl border-border/60 focus-visible:ring-primary/30"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                  />
                  <Label
                    htmlFor="remember"
                    className="cursor-pointer text-sm font-normal text-muted-foreground"
                  >
                    Recordarme
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gap-2 h-11 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground font-semibold tracking-wider">
                      Cuentas demo
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {demoAccounts.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => {
                        setEmail(d.email);
                        setPassword(d.pass);
                      }}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl border border-border/40 p-3 text-left transition-all duration-200 hover:border-primary/20 hover:shadow-sm hover:bg-accent/30",
                        email === d.email &&
                          password === d.pass &&
                          "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-transform group-hover:scale-105",
                          d.bg,
                          d.color,
                        )}
                      >
                        <d.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{d.rol}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                      </div>
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors",
                          email === d.email && password === d.pass
                            ? "bg-primary"
                            : "bg-border group-hover:bg-muted-foreground/30",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
