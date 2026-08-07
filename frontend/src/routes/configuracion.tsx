import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { requireRole } from "@/lib/guard";
import { getUser, api } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import type { Theme } from "@/lib/theme";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  UserRound,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Lock,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/configuracion")({
  beforeLoad: () => requireRole("admin", "profesor", "estudiante", "acudiente"),
  component: ConfiguracionPage,
});

const themeOptions: {
  value: Theme;
  label: string;
  desc: string;
  icon: typeof Sun;
  preview: string;
  previewText: string;
}[] = [
  {
    value: "light",
    label: "Claro",
    desc: "Colores suaves y luminosos para el día.",
    icon: Sun,
    preview: "from-sky-200 via-white to-white",
    previewText: "bg-slate-800",
  },
  {
    value: "dark",
    label: "Oscuro",
    desc: "Reduce el brillo en ambientes con poca luz.",
    icon: Moon,
    preview: "from-slate-800 via-slate-900 to-slate-950",
    previewText: "bg-slate-100",
  },
  {
    value: "system",
    label: "Sistema",
    desc: "Sigue la configuración de tu dispositivo.",
    icon: Monitor,
    preview: "from-sky-200 via-slate-500 to-slate-950",
    previewText: "bg-slate-500",
  },
];

function CampoPerfil({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={label} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input id={label} readOnly value={value} className="bg-muted/40 font-medium" />
    </div>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-0 top-0 flex h-full w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ConfiguracionPage() {
  const user = getUser();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cambiarPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actual || !nueva || !confirmar) {
      toast.error("Completa todos los campos");
      return;
    }
    if (nueva.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (nueva !== confirmar) {
      toast.error("La nueva contraseña y su confirmación no coinciden");
      return;
    }
    setGuardando(true);
    try {
      await api("/api/auth/cambiar-password", {
        method: "POST",
        body: JSON.stringify({ password_actual: actual, password_nueva: nueva }),
      });
      setActual("");
      setNueva("");
      setConfirmar("");
      toast.success("Contraseña actualizada correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la contraseña");
    } finally {
      setGuardando(false);
    }
  }

  function initials(name: string): string {
    return name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <AuthGate roles={["admin", "profesor", "estudiante", "acudiente"]}>
      <PanelShell title="Configuración">
        <div className="mb-6">
          <h2 className="text-lg font-bold tracking-tight">Preferencias de tu cuenta</h2>
          <p className="text-sm text-muted-foreground">
            Personaliza la apariencia, revisa tu perfil y protege tu cuenta
          </p>
        </div>

        <Tabs defaultValue="apariencia" className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
            <TabsTrigger value="apariencia" className="gap-1.5 px-4 py-2 rounded-lg">
              <Palette className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
            <TabsTrigger value="perfil" className="gap-1.5 px-4 py-2 rounded-lg">
              <UserRound className="h-4 w-4" />
              Mi Perfil
            </TabsTrigger>
            <TabsTrigger value="seguridad" className="gap-1.5 px-4 py-2 rounded-lg">
              <ShieldCheck className="h-4 w-4" />
              Seguridad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apariencia">
            <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tema de la interfaz</CardTitle>
                <CardDescription className="text-sm">
                  Elige cómo se ve SIA. Actualmente:{" "}
                  <span className="font-semibold capitalize text-foreground">
                    {theme === "system"
                      ? `sistema (${resolvedTheme === "dark" ? "oscuro" : "claro"})`
                      : theme}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {themeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                          "group cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200",
                          active
                            ? "border-primary/60 bg-primary/5 ring-2 ring-primary/25"
                            : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 shadow-sm",
                              active
                                ? "bg-primary/10 text-primary"
                                : "bg-muted/40 text-muted-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {active && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "mt-3 flex h-14 items-end gap-1.5 rounded-lg bg-gradient-to-br p-2",
                            opt.preview,
                          )}
                        >
                          <span
                            className={cn("h-6 w-1.5 rounded-full opacity-80", opt.previewText)}
                          />
                          <span
                            className={cn("h-9 w-1.5 rounded-full opacity-50", opt.previewText)}
                          />
                          <span
                            className={cn("h-4 w-1.5 rounded-full opacity-30", opt.previewText)}
                          />
                        </div>
                        <p className="mt-3 text-sm font-semibold">{opt.label}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="perfil">
            <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mis datos</CardTitle>
                <CardDescription className="text-sm">
                  Esta información la gestiona el administrador de la institución
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 flex items-center gap-4">
                  <Avatar className="size-16 rounded-2xl border border-border/60 shadow-sm">
                    {user?.foto_url ? (
                      <AvatarImage src={user.foto_url} alt={user.nombre} />
                    ) : (
                      <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 text-primary text-lg font-bold">
                        {user ? initials(user.nombre) : "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-display text-base font-bold">{user?.nombre}</p>
                    <p className="text-sm text-muted-foreground">{user?.correo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CampoPerfil label="Nombre completo" value={user?.nombre ?? ""} />
                  <CampoPerfil label="Correo electrónico" value={user?.correo ?? ""} />
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Rol</Label>
                    <div className="mt-1.5">
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize"
                      >
                        {user?.rol}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seguridad">
            <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-5 w-5 text-emerald-600" />
                  Cambiar contraseña
                </CardTitle>
                <CardDescription className="text-sm">
                  Usa al menos 6 caracteres. Evita contraseñas fáciles de adivinar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={cambiarPassword} className="grid grid-cols-1 gap-4">
                  <PasswordField
                    id="pass-actual"
                    label="Contraseña actual"
                    placeholder="••••••••"
                    value={actual}
                    onChange={setActual}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <PasswordField
                      id="pass-nueva"
                      label="Nueva contraseña"
                      placeholder="Nueva contraseña"
                      value={nueva}
                      onChange={setNueva}
                    />
                    <PasswordField
                      id="pass-confirmar"
                      label="Confirmar nueva contraseña"
                      placeholder="Repite la nueva contraseña"
                      value={confirmar}
                      onChange={setConfirmar}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={guardando} className="gap-1.5">
                      {guardando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Actualizar contraseña
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Si olvidaste tu contraseña, contacta al administrador.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PanelShell>
    </AuthGate>
  );
}
