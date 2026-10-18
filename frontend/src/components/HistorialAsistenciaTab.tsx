import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Inbox,
  Loader2,
  MailWarning,
  Table2,
  X,
} from "lucide-react";
import { api, apiFetch, urlRecurso } from "@/lib/api";
import { MatrizAsistencia } from "@/components/MatrizAsistencia";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import {
  NIVEL_BADGE,
  NIVEL_DOT,
  NIVEL_LABEL,
  UMBRAL_ALERTA,
  UMBRAL_RIESGO,
  aplicarFiltro,
  formatoFecha,
  type FiltroRiesgo,
  type ResumenGrupo,
} from "@/lib/asistencia";

const FILTROS: { value: FiltroRiesgo; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "critico", label: "Riesgo crítico" },
  { value: "alerta", label: "En alerta" },
  { value: "bajo", label: "Bajo riesgo" },
  { value: "sin_registros", label: "Sin registros" },
  { value: "criticas", label: "Fallas críticas" },
];

const ESTADO_LABEL: Record<string, string> = {
  presente: "Presente",
  ausente: "Falta",
  tarde: "Tarde",
  excusa: "Excusa",
};

const ESTADO_BADGE: Record<string, string> = {
  presente: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  ausente: "border-rose-200 bg-rose-500/10 text-rose-700",
  tarde: "border-amber-200 bg-amber-500/10 text-amber-700",
  excusa: "border-sky-200 bg-sky-500/10 text-sky-700",
};

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

async function descargarExportacion(url: string, nombrePorDefecto: string) {
  try {
    const res = await apiFetch(url);
    const blob = await res.blob();
    const objeto = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objeto;
    a.download = nombrePorDefecto;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objeto);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "No se pudo descargar el reporte");
  }
}

export function HistorialAsistenciaTab({
  sel,
  version = 0,
}: {
  sel: number | null;
  version?: number;
}) {
  const [resumen, setResumen] = useState<ResumenGrupo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtro, setFiltro] = useState<FiltroRiesgo>("todos");
  const [vista, setVista] = useState<"tabla" | "matriz">("tabla");
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  const [alertando, setAlertando] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!sel) return;
    let activo = true;
    setCargando(true);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const qs = params.toString();
    api<ResumenGrupo>(`/api/asistencia/resumen/grupo/${sel}${qs ? `?${qs}` : ""}`)
      .then((d) => {
        if (activo) setResumen(d);
      })
      .catch((err) => {
        if (activo)
          toast.error(
            err instanceof Error ? err.message : "Error al cargar el resumen de asistencia",
          );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [sel, desde, hasta, version, revision]);

  function toggleDetalle(id: number) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function limpiarFechas() {
    setDesde("");
    setHasta("");
  }

  const filas = aplicarFiltro(resumen?.estudiantes ?? [], filtro);
  const totales = resumen?.totales;

  function construirQs(): string {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    return params.toString();
  }

  const qs = construirQs();
  const prefijo = `/api/asistencia/reportes/grupo/${sel}${qs ? `?${qs}` : ""}`;
  const nombreBase = resumen ? resumen.grupo.codigo_grupo : "asistencia";

  async function alertarRiesgo() {
    if (!sel || !resumen) return;
    const enRiesgo = resumen.estudiantes.filter(
      (f) => f.en_riesgo || f.fallas_criticas || f.nivel === "critico",
    );
    if (enRiesgo.length === 0) {
      toast.info("No hay estudiantes en riesgo que notificar");
      return;
    }
    setAlertando(true);
    try {
      const d = await api<{ ok: boolean; notificados: number }>(
        `/api/asistencia/alerta/grupo/${sel}`,
        {
          method: "POST",
          body: JSON.stringify({ estudiante_ids: enRiesgo.map((f) => f.estudiante_id) }),
        },
      );
      toast.success(`${d.notificados} notificaciones de alerta enviadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar alertas");
    } finally {
      setAlertando(false);
    }
  }

  const ordenadas = [...filas].sort((a, b) => {
    if (a.porcentaje == null && b.porcentaje == null)
      return a.estudiante.localeCompare(b.estudiante);
    if (a.porcentaje == null) return 1;
    if (b.porcentaje == null) return -1;
    return a.porcentaje - b.porcentaje || a.estudiante.localeCompare(b.estudiante);
  });

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Asistencia promedio"
          value={totales?.porcentaje_general != null ? `${totales.porcentaje_general}%` : "—"}
          icon={CalendarCheck}
          accent={
            totales?.porcentaje_general == null
              ? "primary"
              : totales.porcentaje_general >= UMBRAL_ALERTA
                ? "emerald"
                : totales.porcentaje_general >= UMBRAL_RIESGO
                  ? "amber"
                  : "rose"
          }
        />
        <StatCard
          label={`En riesgo (<${UMBRAL_RIESGO}%)`}
          value={totales?.en_riesgo ?? 0}
          icon={AlertTriangle}
          accent={(totales?.en_riesgo ?? 0) === 0 ? "emerald" : "rose"}
        />
        <StatCard
          label="En alerta"
          value={totales?.niveles?.alerta ?? 0}
          icon={BarChart3}
          accent={(totales?.niveles?.alerta ?? 0) === 0 ? "emerald" : "amber"}
        />
        <StatCard
          label="Riesgo crítico"
          value={totales?.niveles?.critico ?? 0}
          icon={Clock}
          accent={(totales?.niveles?.critico ?? 0) === 0 ? "emerald" : "rose"}
        />
        <StatCard
          label="Fallas totales"
          value={totales?.fallas ?? 0}
          icon={FileText}
          accent={(totales?.fallas ?? 0) === 0 ? "emerald" : "amber"}
        />
      </div>

      <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Resumen histórico por estudiante
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!resumen || alertando}
                onClick={() => void alertarRiesgo()}
                className="gap-1.5 h-9 rounded-lg border-border/60 text-rose-700"
              >
                {alertando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MailWarning className="h-3.5 w-3.5" />
                )}
                Notificar en riesgo
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!sel}
                onClick={() =>
                  void descargarExportacion(
                    `${prefijo}/exportar?formato=xlsx`,
                    `${nombreBase}-asistencia.xlsx`,
                  )
                }
                className="gap-1.5 h-9 rounded-lg border-border/60"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                XLSX
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!sel}
                onClick={() =>
                  void descargarExportacion(
                    `${prefijo}/exportar?formato=csv`,
                    `${nombreBase}-asistencia.csv`,
                  )
                }
                className="gap-1.5 h-9 rounded-lg border-border/60"
              >
                <FileDown className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!sel}
                onClick={() =>
                  void descargarExportacion(`${prefijo}/pdf`, `${nombreBase}-asistencia.pdf`)
                }
                className="gap-1.5 h-9 rounded-lg border-border/60"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <div className="flex flex-wrap items-end gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="fila-desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input
              id="fila-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-9 w-44 rounded-lg border-border/60 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fila-hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="fila-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="h-9 w-44 rounded-lg border-border/60 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fila-filtro" className="text-xs text-muted-foreground">
              Semáforo
            </Label>
            <select
              id="fila-filtro"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroRiesgo)}
              className="input-field h-9 w-auto rounded-lg px-3 text-sm"
            >
              {FILTROS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fila-vista" className="text-xs text-muted-foreground">
              Vista
            </Label>
            <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setVista("tabla")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  vista === "tabla"
                    ? "bg-background text-emerald-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Resumen
              </button>
              <button
                type="button"
                onClick={() => setVista("matriz")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  vista === "matriz"
                    ? "bg-background text-emerald-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
                Matriz
              </button>
            </div>
          </div>
          {(desde || hasta) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limpiarFechas}
              className="h-9 gap-1 rounded-lg border-border/60 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtro
            </Button>
          )}
        </div>

        {vista === "matriz" ? (
          <MatrizAsistencia
            sel={sel}
            filas={resumen?.estudiantes ?? []}
            cargando={cargando}
            onGuardado={() => setRevision((r) => r + 1)}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estudiante
                </TableHead>
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estados
                </TableHead>
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fallas
                </TableHead>
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  % Asistencia
                </TableHead>
                <TableHead className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detalle
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm font-medium">Cargando resumen...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {ordenadas.map((f, i) => {
                    const puedeExpandir = f.registros.length > 0;
                    const abierto = abiertos.has(f.estudiante_id);
                    return (
                      <Fragment key={f.estudiante_id}>
                        <TableRow
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                            f.nivel === "critico" && "bg-rose-500/5 hover:bg-rose-500/10",
                            f.nivel === "alerta" && "bg-amber-500/5 hover:bg-amber-500/10",
                            abierto && "bg-muted/20 hover:bg-muted/20",
                          )}
                        >
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border/60">
                                {f.foto_url ? (
                                  <AvatarImage src={urlRecurso(f.foto_url)} alt={f.estudiante} />
                                ) : null}
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-700 text-xs font-semibold">
                                  {iniciales(f.estudiante)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{f.estudiante}</div>
                                <div className="text-xs text-muted-foreground">{f.correo}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant="outline"
                                className="rounded-full border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              >
                                {f.presentes} P
                              </Badge>
                              <Badge
                                variant="outline"
                                className="rounded-full border-rose-200 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700"
                              >
                                {f.ausentes} A
                              </Badge>
                              <Badge
                                variant="outline"
                                className="rounded-full border-amber-200 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                              >
                                {f.tardes} T
                              </Badge>
                              <Badge
                                variant="outline"
                                className="rounded-full border-sky-200 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700"
                              >
                                {f.excusas} E
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                f.fallas > 0 ? "text-rose-600" : "text-muted-foreground",
                              )}
                            >
                              {f.fallas}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="min-w-[170px] space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                    NIVEL_BADGE[f.nivel],
                                  )}
                                >
                                  <span
                                    className={cn("h-2 w-2 rounded-full", NIVEL_DOT[f.nivel])}
                                  />
                                  {f.porcentaje != null ? `${f.porcentaje}%` : "Sin registros"}
                                </Badge>
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {NIVEL_LABEL[f.nivel]}
                                </span>
                              </div>
                              <Progress
                                value={f.porcentaje ?? 0}
                                className={cn(
                                  "h-2",
                                  f.nivel === "critico" && "bg-rose-500/20",
                                  f.nivel === "alerta" && "bg-amber-500/20",
                                )}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            {puedeExpandir ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleDetalle(f.estudiante_id)}
                                className={cn(
                                  "h-8 w-8 rounded-full p-0",
                                  abierto
                                    ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                aria-expanded={abierto}
                                aria-label={
                                  abierto
                                    ? `Ocultar historial de ${f.estudiante}`
                                    : `Ver historial de ${f.estudiante}`
                                }
                              >
                                {abierto ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {abierto && (
                          <TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={5} className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                {f.registros.map((reg) => {
                                  const porRiesgo =
                                    reg.estado === "ausente" || reg.estado === "tarde";
                                  const auditado = reg.modificado_por && reg.fecha_modificacion;
                                  return (
                                    <div
                                      key={reg.fecha}
                                      className={cn(
                                        "flex max-w-xs flex-col gap-1 rounded-lg border border-border/50 px-3 py-1.5",
                                        porRiesgo && "border-rose-200/60 bg-rose-500/5",
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="whitespace-nowrap text-xs font-medium">
                                          {formatoFecha(reg.fecha)}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "rounded-full px-2 py-0.5 text-xs font-medium",
                                            ESTADO_BADGE[reg.estado],
                                          )}
                                        >
                                          {ESTADO_LABEL[reg.estado]}
                                        </Badge>
                                        {auditado && (
                                          <span
                                            title={`Editada el ${reg.fecha_modificacion} por ${reg.modificado_por}${
                                              reg.justificacion ? ` — ${reg.justificacion}` : ""
                                            }`}
                                            className="cursor-help text-[10px] font-medium text-amber-600"
                                          >
                                            ● editada
                                          </span>
                                        )}
                                      </div>
                                      {reg.observacion && (
                                        <span className="max-w-[220px] truncate text-xs text-muted-foreground">
                                          {reg.observacion}
                                        </span>
                                      )}
                                      {reg.justificacion && (
                                        <span className="text-[10px] text-amber-700">
                                          Just.: {reg.justificacion}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  {ordenadas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <Inbox className="h-6 w-6 opacity-40" />
                          </div>
                          <span className="text-sm font-medium">
                            {sel
                              ? "Sin registros para el filtro seleccionado."
                              : "Selecciona un grupo para ver el resumen."}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
