import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, getUser } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  X,
} from "lucide-react";

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

type FormEvento = {
  titulo: string;
  tipo: TipoEvento;
  fecha: string;
  hora: string;
  descripcion: string;
};

const TIPO_LABEL: Record<TipoEvento, string> = {
  institucional: "Institucional",
  evaluacion: "Evaluación",
  entrega: "Entrega de tarea",
  reunion: "Reunión",
};

const TIPO_DOT: Record<TipoEvento, string> = {
  institucional: "bg-emerald-500",
  evaluacion: "bg-rose-500",
  entrega: "bg-blue-500",
  reunion: "bg-violet-500",
};

const TIPO_CHIP: Record<TipoEvento, string> = {
  institucional: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  evaluacion: "border-rose-200 bg-rose-500/10 text-rose-700",
  entrega: "border-blue-200 bg-blue-500/10 text-blue-700",
  reunion: "border-violet-200 bg-violet-500/10 text-violet-700",
};

const TIPOS_CREAR: { value: TipoEvento; label: string }[] = [
  { value: "institucional", label: "Institucional" },
  { value: "evaluacion", label: "Evaluación" },
  { value: "entrega", label: "Entrega de tarea" },
  { value: "reunion", label: "Reunión" },
];

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function horaEvento(fechaInicio: string): string | null {
  const d = new Date(fechaInicio);
  if (Number.isNaN(d.getTime())) return null;
  const h = format(d, "HH:mm");
  return h === "00:00" ? null : h;
}

function CalendarioView() {
  const user = getUser();
  const puedeCrear = user?.rol === "admin" || user?.rol === "profesor";

  const [vista, setVista] = useState<"mes" | "semana">("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<Evento | null>(null);
  const [diaSel, setDiaSel] = useState<Date | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errForm, setErrForm] = useState("");
  const [form, setForm] = useState<FormEvento>(() => ({
    titulo: "",
    tipo: "institucional",
    fecha: ymd(new Date()),
    hora: "08:00",
    descripcion: "",
  }));

  const rango = useMemo(() => {
    if (vista === "mes") {
      const inicio = startOfMonth(cursor);
      return { desde: ymd(inicio), hasta: ymd(endOfMonth(cursor)) };
    }
    const inicio = startOfWeek(cursor, { weekStartsOn: 1 });
    return { desde: ymd(inicio), hasta: ymd(addDays(inicio, 6)) };
  }, [vista, cursor]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    api<Evento[]>(`/api/calendario/eventos?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then((d) => {
        if (activo) setEventos(d);
      })
      .catch((err) => {
        if (activo)
          toast.error(err instanceof Error ? err.message : "Error al cargar el calendario");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [rango.desde, rango.hasta, recarga]);

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
    setDiaSel(null);
  }

  function abrirNuevo(fecha?: Date) {
    const base = fecha ?? new Date();
    setForm({
      titulo: "",
      tipo: user?.rol === "profesor" ? "evaluacion" : "institucional",
      fecha: ymd(base),
      hora: "08:00",
      descripcion: "",
    });
    setErrForm("");
    setNuevoOpen(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.fecha) {
      setErrForm("Completa al menos el título y la fecha del evento.");
      return;
    }
    setGuardando(true);
    try {
      await api<{ ok: boolean; id: number }>("/api/calendario/eventos", {
        method: "POST",
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim() || null,
          fecha_inicio: `${form.fecha}T${form.hora || "08:00"}:00`,
          fecha_fin: null,
          tipo: form.tipo,
        }),
      });
      toast.success("Evento creado correctamente");
      setNuevoOpen(false);
      setRecarga((x) => x + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el evento");
    } finally {
      setGuardando(false);
    }
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

  function panelDia() {
    if (!diaSel) return null;
    const key = ymd(diaSel);
    const evs = (porDia.get(key) ?? []).sort(
      (a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime(),
    );
    return (
      <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl lg:col-start-2 lg:row-start-1 lg:self-start">
        <div className="h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />
        <CardContent className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold capitalize">
                {format(diaSel, "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(diaSel, "yyyy", { locale: es })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => setDiaSel(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {evs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos programados este día.</p>
          ) : (
            <ul className="space-y-2">
              {evs.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setSeleccionado(e)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-opacity hover:opacity-80",
                      TIPO_CHIP[e.tipo],
                    )}
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", TIPO_DOT[e.tipo])} />
                    <span className="truncate">{e.titulo}</span>
                    {horaEvento(e.fecha_inicio) && (
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] opacity-80">
                        <Clock className="h-3 w-3" />
                        {horaEvento(e.fecha_inicio)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {puedeCrear && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full gap-1.5"
              onClick={() => abrirNuevo(diaSel)}
            >
              <CalendarPlus className="h-4 w-4" />
              Nuevo evento este día
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <AuthGate roles={["admin", "profesor", "estudiante", "acudiente"]}>
      <PanelShell title="Calendario Académico">
        {/* Encabezado de control */}
        <Card className="mb-6 overflow-hidden border-border/50 shadow-sm rounded-xl">
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
                  onClick={() => {
                    setCursor(new Date());
                    setDiaSel(new Date());
                  }}
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
                {puedeCrear && (
                  <Button size="sm" onClick={() => abrirNuevo()} className="h-9 gap-1.5 rounded-lg">
                    <Plus className="h-4 w-4" />
                    Nuevo Evento
                  </Button>
                )}
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
          <div className="min-w-0">
            {/* Vista de mes */}
            {vista === "mes" ? (
              <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
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
                    const esSel = diaSel !== null && ymd(diaSel) === key;
                    return (
                      <div
                        key={i}
                        onClick={() => setDiaSel(d)}
                        className={cn(
                          "min-h-[96px] cursor-pointer border-b border-r border-border/40 p-1.5 transition-colors hover:bg-muted/30 sm:min-h-[110px] sm:p-2",
                          (i + 1) % 7 === 0 && "border-r-0",
                          !enMes && "bg-muted/20",
                          esSel && "bg-primary/5 ring-1 ring-inset ring-primary/30",
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
                  const esSel = diaSel !== null && ymd(diaSel) === key;
                  return (
                    <Card
                      key={key}
                      onClick={() => setDiaSel(d)}
                      className={cn(
                        "cursor-pointer overflow-hidden border-border/50 shadow-sm rounded-xl transition-colors hover:bg-muted/20",
                        esHoy && "border-primary/40 ring-1 ring-primary/20",
                        esSel && "ring-1 ring-primary/40",
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
                                <span
                                  className={cn("h-1.5 w-1.5 rounded-full", TIPO_DOT[e.tipo])}
                                />
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
          </div>

          {/* Panel del día seleccionado */}
          {panelDia()}
        </div>

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
                  <p className="text-xs text-blue-600">Fecha límite de entrega de tarea.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Nuevo evento */}
        <Dialog open={nuevoOpen} onOpenChange={(v) => !v && setNuevoOpen(false)}>
          <DialogContent className="sm:max-w-md rounded-2xl border-border/60">
            <DialogHeader>
              <DialogTitle>Nuevo evento</DialogTitle>
              <DialogDescription>Agenda un evento en el calendario académico.</DialogDescription>
            </DialogHeader>
            <form onSubmit={guardar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-titulo">Título</Label>
                <Input
                  id="ev-titulo"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej. Parcial de Matemáticas"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-tipo">Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as TipoEvento }))}
                >
                  <SelectTrigger id="ev-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CREAR.filter(
                      (o) => !(user?.rol === "profesor" && o.value === "institucional"),
                    ).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-fecha">Fecha</Label>
                  <Input
                    id="ev-fecha"
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-hora">Hora</Label>
                  <Input
                    id="ev-hora"
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-desc">Descripción</Label>
                <Textarea
                  id="ev-desc"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles del evento (opcional)"
                  rows={3}
                />
              </div>
              {errForm && <p className="text-sm text-destructive">{errForm}</p>}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNuevoOpen(false)}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar evento"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PanelShell>
    </AuthGate>
  );
}
