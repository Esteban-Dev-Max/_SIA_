import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";

export const Route = createFileRoute("/calendario")({
  beforeLoad: () => requireRole("admin", "profesor", "estudiante", "acudiente"),
  component: CalendarioView,
});

type TipoEvento = "institucional" | "evaluacion" | "entrega" | "reunion";
type Evento = {
  id: string;
  origen: "evento" | "tarea";
  titulo: string;
  descripcion: string | null;
  materia: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo: TipoEvento;
};

const TIPO_LABEL: Record<TipoEvento, string> = {
  institucional: "Institucional",
  evaluacion: "Evaluación",
  entrega: "Entrega de tarea",
  reunion: "Reunión",
};

const TIPO_DOT: Record<TipoEvento, string> = {
  institucional: "bg-sky-500",
  evaluacion: "bg-rose-500",
  entrega: "bg-amber-500",
  reunion: "bg-violet-500",
};

const TIPO_CHIP: Record<TipoEvento, string> = {
  institucional: "border-sky-200 bg-sky-500/10 text-sky-700",
  evaluacion: "border-rose-200 bg-rose-500/10 text-rose-700",
  entrega: "border-amber-200 bg-amber-500/10 text-amber-700",
  reunion: "border-violet-200 bg-violet-500/10 text-violet-700",
};

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function CalendarioView() {
  const [vista, setVista] = useState<"mes" | "semana">("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<Evento | null>(null);

  const rango = useMemo(() => {
    if (vista === "mes") {
      const inicio = startOfMonth(cursor);
      return { desde: ymd(inicio), hasta: ymd(endOfMonth(cursor)) };
    }
    const inicio = startOfWeek(cursor, { weekStartsOn: 1 });
    return { desde: ymd(inicio), hasta: ymd(addDays(inicio, 6)) };
  }, [vista, cursor]);

  useEffect(() => {
    setCargando(true);
    api<Evento[]>(`/api/calendario/eventos?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then(setEventos)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar el calendario"),
      )
      .finally(() => setCargando(false));
  }, [rango.desde, rango.hasta]);

  const porDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const ev of eventos) {
      const key = ymd(new Date(ev.fecha_inicio));
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [eventos]);

  const celdas = useMemo(() => {
    if (vista === "mes") {
      const inicio = startOfMonth(cursor);
      const offset =
        (startOfWeek(inicio, { weekStartsOn: 1 }).getTime() - inicio.getTime()) / -86400000;
      const gridStart = addDays(inicio, -offset);
      return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    }
    const inicio = startOfWeek(cursor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  }, [vista, cursor]);

  const titulo =
    vista === "mes"
      ? format(cursor, "MMMM yyyy", { locale: es })
      : `Semana del ${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d 'de' MMMM", { locale: es })}`;

  function mover(dir: 1 | -1) {
    if (vista === "mes") setCursor((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
    else setCursor((c) => (dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));
  }

  function chip(e: Evento) {
    return (
      <button
        key={e.id}
        onClick={() => setSeleccionado(e)}
        className={cn(
          "flex w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80",
          TIPO_CHIP[e.tipo],
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TIPO_DOT[e.tipo])} />
        <span className="truncate">{e.titulo}</span>
      </button>
    );
  }

  return (
    <AuthGate roles={["admin", "profesor", "estudiante", "acudiente"]}>
      <PanelShell title="Calendario Académico">
        {/* Encabezado de control */}
        <Card className="mb-6 border-border/50 shadow-sm rounded-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => mover(-1)}
                  className="h-9 w-9 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => mover(1)}
                  className="h-9 w-9 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="ml-2 text-base font-semibold capitalize">{titulo}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCursor(new Date())}
                  className="ml-1 h-9 rounded-lg text-xs"
                >
                  Hoy
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
                  {(["mes", "semana"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVista(v)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                        vista === v
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Eventos y entregas de tareas
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leyenda */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {(Object.keys(TIPO_LABEL) as TipoEvento[]).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={cn("h-2 w-2 rounded-full", TIPO_DOT[t])} />
              {TIPO_LABEL[t]}
            </span>
          ))}
        </div>

        {/* Vista de mes */}
        {vista === "mes" ? (
          <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map((d, i) => {
                const key = ymd(d);
                const evs = porDia.get(key) ?? [];
                const enMes = isSameMonth(d, cursor);
                const visible = evs.slice(0, 3);
                const extra = evs.length - visible.length;
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[96px] border-b border-r border-border/40 p-1.5 sm:min-h-[110px] sm:p-2",
                      (i + 1) % 7 === 0 && "border-r-0",
                      !enMes && "bg-muted/20",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(d) && "bg-primary text-primary-foreground font-bold",
                        !enMes && "text-muted-foreground/60",
                        enMes && !isToday(d) && "text-foreground",
                      )}
                    >
                      {format(d, "d")}
                    </div>
                    <div className="space-y-1">
                      {visible.map(chip)}
                      {extra > 0 && (
                        <button
                          onClick={() => setCursor(d)}
                          className="block w-full text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          +{extra} más
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          /* Vista de semana */
          <div className="space-y-3">
            {celdas.map((d) => {
              const key = ymd(d);
              const evs = porDia.get(key) ?? [];
              const esHoy = isToday(d);
              return (
                <Card
                  key={key}
                  className={cn(
                    "border-border/50 shadow-sm rounded-xl overflow-hidden",
                    esHoy && "border-primary/40 ring-1 ring-primary/20",
                  )}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold",
                          esHoy ? "bg-primary text-primary-foreground" : "bg-muted/60",
                        )}
                      >
                        {format(d, "d")}
                      </span>
                      <span className="text-sm font-semibold capitalize">
                        {format(d, "EEEE", { locale: es })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(d, "MMMM yyyy", { locale: es })}
                      </span>
                    </div>
                    {evs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin eventos programados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {evs.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setSeleccionado(e)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-80",
                              TIPO_CHIP[e.tipo],
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", TIPO_DOT[e.tipo])} />
                            {format(new Date(e.fecha_inicio), "HH:mm")} · {e.titulo}
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {cargando && (
          <div className="mt-4 text-center text-xs text-muted-foreground">Cargando eventos…</div>
        )}
        {!cargando && eventos.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <CalendarDays className="h-8 w-8 opacity-40" />
            <span className="text-sm font-medium">Sin eventos en este rango</span>
            <span className="text-xs">Las tareas y eventos institucionales aparecerán aquí.</span>
          </div>
        )}

        {/* Detalle de evento */}
        <Dialog open={seleccionado !== null} onOpenChange={(v) => !v && setSeleccionado(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-6">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    TIPO_DOT[seleccionado?.tipo ?? "institucional"],
                  )}
                />
                {seleccionado?.titulo}
              </DialogTitle>
            </DialogHeader>
            {seleccionado && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn("rounded-full text-xs font-medium", TIPO_CHIP[seleccionado.tipo])}
                  >
                    {TIPO_LABEL[seleccionado.tipo]}
                  </Badge>
                  {seleccionado.materia && (
                    <Badge variant="outline" className="rounded-full text-xs font-normal">
                      {seleccionado.materia}
                    </Badge>
                  )}
                </div>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {format(new Date(seleccionado.fecha_inicio), "EEEE d 'de' MMMM yyyy, HH:mm", {
                    locale: es,
                  })}
                  {seleccionado.fecha_fin &&
                    ` — ${format(new Date(seleccionado.fecha_fin), "HH:mm", { locale: es })}`}
                </p>
                {seleccionado.descripcion && (
                  <p className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                    {seleccionado.descripcion}
                  </p>
                )}
                {seleccionado.origen === "tarea" && (
                  <p className="text-xs text-amber-700">Fecha límite de entrega de tarea.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PanelShell>
    </AuthGate>
  );
}
