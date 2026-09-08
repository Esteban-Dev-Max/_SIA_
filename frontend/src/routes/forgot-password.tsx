import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      toast.error("Ingresa un correo electrónico válido");
      return;
    }
    setLoading(true);
    try {
      await api<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ correo: email }),
      });
      setEnviado(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar la solicitud");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-in">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <Card className="w-full overflow-hidden rounded-2xl border-border/50 shadow-xl">
          <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-purple-600" />
          <CardHeader className="space-y-1 pb-4 pt-6">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 shadow-sm">
              {enviado ? (
                <ShieldCheck className="h-6 w-6 text-primary" />
              ) : (
                <KeyRound className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-display">
              {enviado ? "Revisa tu correo" : "Recuperar contraseña"}
            </CardTitle>
            <CardDescription>
              {enviado
                ? "Te enviamos las instrucciones para restablecer tu contraseña."
                : "Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {enviado ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Si el correo está registrado, recibirás las instrucciones en tu bandeja de
                  entrada. El enlace es válido por 1 hora. Revisa también la carpeta de spam.
                </p>
                <Button
                  asChild
                  className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/20 transition-all duration-300"
                >
                  <Link to="/login">Volver al inicio de sesión</Link>
                </Button>
              </div>
            ) : (
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
                      className="h-11 rounded-xl border-border/60 pl-10 focus-visible:ring-primary/30"
                      placeholder="tu@correo.com"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/20 transition-all duration-300"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {loading ? "Enviando..." : "Enviar enlace"}
                </Button>

                <p className="text-center text-sm">
                  <Link
                    to="/login"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    ¿Recordaste tu contraseña? Inicia sesión
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
