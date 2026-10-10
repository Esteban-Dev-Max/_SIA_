import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Upload,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Send,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/estudiante/tareas")({
  component: EstudianteTareas,
});

type TareaEstudiante = {
  tarea_id: number;
  titulo: string;
  descripcion: string | null;
  fecha_entrega: string | null;
  puntaje_max: number | string;
  materia: string;
  materia_codigo: string;
  periodo: string;
  grupo_id: number;
  entrega_id: number | null;
  archivo_url: string | null;
  fecha_entrega_entrega: string | null;
  calificacion: number | string | null;
  comentario: string | null;
  retroalimentacion: string | null;
};

function num(v: number | string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtFecha(v: string | null): string {
  if (!v) return "—";
  try {
    return format(new Date(v), "d MMM yyyy", { locale: es });
  } catch {
    return v;
  }
}

// Badge con color según la proximidad de la fecha límite.
function plazoBadge(fecha: string | null) {
  if (!fecha) {
    return (
      <Badge
        variant="outline"
        className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      >
        Sin fecha límite
      </Badge>
    );
  }
  const dias = (new Date(fecha).getTime() - Date.now()) / 86400000;
  if (dias < 0) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-rose-200 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700"
      >
        Vencida
      </Badge>
    );
  }
  if (dias <= 3) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-amber-200 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700"
      >
        {Math.ceil(dias)} días restantes
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="rounded-full border-emerald-200 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
    >
      {fmtFecha(fecha)}
    </Badge>
  );
}

function EstudianteTareas() {
  const [tareas, setTareas] = useState<TareaEstudiante[]>([]);
  const [cargando, setCargando] = useState(true);

  const [entregando, setEntregando] = useState<TareaEstudiante | null>(null);
  const [envio, setEnvio] = useState({ archivo_url: "", comentario: "" });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api<TareaEstudiante[]>("/api/tareas/estudiante");
      setTareas(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar tareas");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = tareas.filter((t) => t.entrega_id == null);
  const completadas = tareas.filter((t) => t.entrega_id != null);

  function abrirEntrega(t: TareaEstudiante) {
    setEntregando(t);
    setEnvio({ archivo_url: t.archivo_url ?? "", comentario: t.comentario ?? "" });
  }

  async function enviarEntrega() {
    if (!entregando || !envio.archivo_url.trim()) {
      toast.error("Adjunta un enlace o archivo para entregar");
      return;
    }
    setGuardando(true);
    try {
      await api(`/api/tareas/${entregando.tarea_id}/entregar`, {
        method: "POST",
        body: JSON.stringify({
          archivo_url: envio.archivo_url,
          comentario: envio.comentario,
        }),
      });
      toast.success("Entrega registrada correctamente");
      setEntregando(null);
      cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al entregar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tareas asignadas"
          value={tareas.length}
          icon={ClipboardList}
          accent="primary"
        />
        <StatCard
          label="Pendientes"
          value={pendientes.length}
          icon={Clock}
          accent={pendientes.length ? "amber" : "emerald"}
        />
        <StatCard
          label="Entregadas"
          value={completadas.length}
          icon={CheckCircle2}
          accent="emerald"
        />
      </div>

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando tareas…
        </div>
      ) : (
        <div className="space-y-10">
          {/* Pendientes */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold font-display">
                Pendientes
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({pendientes.length})
                </span>
              </h2>
            </div>

            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes tareas pendientes por entregar. ¡Buen trabajo!
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {pendientes.map((t) => (
                  <Card
                    key={t.tarea_id}
                    className="border-border/50 shadow-sm rounded-xl overflow-hidden"
                  >
                    <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                    <CardContent className="p-5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full text-xs font-normal px-2.5"
                        >
                          {t.materia}
                        </Badge>
                        {plazoBadge(t.fecha_entrega)}
                      </div>
                      <h3 className="font-semibold leading-snug">{t.titulo}</h3>
                      {t.descripcion && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {t.descripcion}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Puntaje máximo:{" "}
                          <span className="font-medium">
                            {num(t.puntaje_max)?.toFixed(1) ?? "—"}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          onClick={() => abrirEntrega(t)}
                          className="gap-1.5 h-8 rounded-lg"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Entregar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Completadas */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold font-display">
                Completadas
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({completadas.length})
                </span>
              </h2>
            </div>

            {completadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no has entregado ninguna tarea.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {completadas.map((t) => {
                  const calif = num(t.calificacion);
                  const max = num(t.puntaje_max);
                  const calificada = calif != null;
                  return (
                    <Card
                      key={t.tarea_id}
                      className="border-border/50 shadow-sm rounded-xl overflow-hidden"
                    >
                      <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                      <CardContent className="p-5">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className="rounded-full text-xs font-normal px-2.5"
                          >
                            {t.materia}
                          </Badge>
                          {calificada ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                calif >= (max ?? 0) * 0.6
                                  ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                                  : "border-amber-200 bg-amber-500/10 text-amber-700",
                              )}
                            >
                              Calificada: {calif.toFixed(1)}/{max?.toFixed(1)}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full border-sky-200 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-700"
                            >
                              En revisión
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold leading-snug">{t.titulo}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Entregada el {fmtFecha(t.fecha_entrega_entrega)}
                        </p>
                        {t.retroalimentacion && (
                          <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Retroalimentación:</span>{" "}
                            {t.retroalimentacion}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          {t.archivo_url ? (
                            <a
                              href={t.archivo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Ver entrega
                            </a>
                          ) : (
                            <span />
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEntrega(t)}
                            className="gap-1.5 h-8 rounded-lg"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Re-entregar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal de entrega */}
      <Dialog open={entregando !== null} onOpenChange={(v) => !v && setEntregando(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {entregando?.entrega_id ? "Re-entregar tarea" : "Entregar tarea"}
            </DialogTitle>
            <DialogDescription>
              {entregando
                ? `${entregando.materia} · ${entregando.titulo} · Entrega límite ${fmtFecha(entregando.fecha_entrega)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="archivo">Enlace del archivo / trabajo</Label>
              <Input
                id="archivo"
                value={envio.archivo_url}
                onChange={(e) => setEnvio((s) => ({ ...s, archivo_url: e.target.value }))}
                placeholder="https://drive.google.com/… o ruta del archivo"
                className="rounded-lg border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comentario">Comentario (opcional)</Label>
              <Textarea
                id="comentario"
                value={envio.comentario}
                onChange={(e) => setEnvio((s) => ({ ...s, comentario: e.target.value }))}
                placeholder="Notas para el docente sobre tu entrega…"
                className="rounded-lg border-border/60"
              />
            </div>
            {entregando?.fecha_entrega &&
              new Date(entregando.fecha_entrega).getTime() < Date.now() && (
                <p className="flex items-start gap-1.5 text-xs text-rose-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Esta tarea ya venció; la entrega quedará marcada como tardía.
                </p>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntregando(null)}>
              Cancelar
            </Button>
            <Button onClick={enviarEntrega} disabled={guardando} className="gap-1.5 rounded-lg">
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
