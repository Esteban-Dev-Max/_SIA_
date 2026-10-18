import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Inbox,
  Loader2,
  MailWarning,
  QrCode,
  X,
} from "lucide-react";
import { api, apiFetch } from "@/lib/api";
import { AsistenciaPanel } from "@/components/AsistenciaPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { NIVEL_BADGE, NIVEL_DOT, NIVEL_LABEL } from "@/lib/asistencia";
import type { NivelRiesgo } from "@/lib/asistencia";

export const Route = createFileRoute("/admin/asistencia")({
  component: AdminAsistencia,
});

type TotalesGrupo = {
  presentes: number;
  ausentes: number;
  tardes: number;
  excusas: number;
  total: number;
  fallas: number;
  porcentaje_general: number | null;
  en_riesgo: number;
  fallas_criticas: number;
  niveles: Record<NivelRiesgo, number>;
};

type FilaPanorama = {
  id: number;
  codigo_grupo: string;
  materia: string;
  materia_codigo: string | null;
  periodo: string | null;
  horario: string | null;
  alumnos: number;
  totales: TotalesGrupo;
};

type PanoramaResponse = {
  grupos: FilaPanorama[];
  desde: string | null;
  hasta: string | null;
};

function nivelDominante(t: TotalesGrupo): NivelRiesgo {
  const orden: NivelRiesgo[] = ["critico", "alerta", "bajo", "sin_registros"];
  let mejor: NivelRiesgo = "sin_registros";
  for (const n of orden) {
    if ((t.niveles[n] ?? 0) > 0) {
      mejor = n;
      break;
    }
  }
  return mejor;
}

async function descargarExportacion(url: string, nombre: string) {
  try {
    const res = await apiFetch(url);
    const blob = await res.blob();
    const objeto = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objeto;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objeto);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "No se pudo descargar el reporte");
  }
}

function AdminAsistencia() {
  const [panorama, setPanorama] = useState<PanoramaResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  const [alertando, setAlertando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const qs = params.toString();
    api<PanoramaResponse>(`/api/asistencia/panorama${qs ? `?${qs}` : ""}`)
      .then((d) => {
        if (activo) setPanorama(d);
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "Error al cargar el panorama");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  function limpiarFechas() {
    setDesde("");
    setHasta("");
  }

  const g = panorama?.grupos ?? [];
  const presentes = g.reduce((s, x) => s + x.totales.presentes, 0);
  const registrados = g.reduce((s, x) => s + x.totales.total, 0);
  const pctGlobal = registrados > 0 ? Math.round((presentes / registrados) * 100) : null;
  const enRiesgo = g.reduce((s, x) => s + x.totales.en_riesgo, 0);
  const criticos = g.reduce((s, x) => s + x.totales.niveles.critico, 0);
  const alertas = g.reduce((s, x) => s + x.totales.niveles.alerta, 0);
  const fallas = g.reduce((s, x) => s + x.totales.fallas, 0);

  async function alertarTodos() {
    if (alertando) return;
    setAlertando(true);
    try {
      const enRiesgoPorGrupo: { grupo_id: number; ids: number[] }[] = [];
      for (const x of g) {
        const detalle = await api<{
          estudiantes: {
            estudiante_id: number;
            en_riesgo: boolean;
            fallas_criticas: boolean;
            nivel: NivelRiesgo;
          }[];
        }>(`/api/asistencia/resumen/grupo/${x.id}`).catch(() => null);
        if (!detalle) continue;
        const ids = detalle.estudiantes
          .filter((e) => e.en_riesgo || e.fallas_criticas || e.nivel === "critico")
          .map((e) => e.estudiante_id);
        if (ids.length > 0) enRiesgoPorGrupo.push({ grupo_id: x.id, ids });
      }
      if (enRiesgoPorGrupo.length === 0) {
        toast.info("No hay estudiantes en riesgo que notificar");
        return;
      }
      let total = 0;
      for (const p of enRiesgoPorGrupo) {
        const d = await api<{ ok: boolean; notificados: number }>(
          `/api/asistencia/alerta/grupo/${p.grupo_id}`,
          {
            method: "POST",
            body: JSON.stringify({ estudiante_ids: p.ids }),
          },
        );
        total += d.notificados;
      }
      toast.success(`${total} notificaciones de alerta enviadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar alertas");
    } finally {
      setAlertando(false);
    }
  }

  const gruposSorteados = [...g].sort(
    (a, b) =>
      b.totales.en_riesgo - a.totales.en_riesgo || a.codigo_grupo.localeCompare(b.codigo_grupo),
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight">Asistencia institucional</h2>
        <p className="text-sm text-muted-foreground">
          Semáforo de riesgo por clase y notificaciones preventivas
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Clases" value={g.length || "—"} icon={QrCode} accent="primary" />
        <StatCard
          label="Asistencia global"
          value={pctGlobal != null ? `${pctGlobal}%` : "—"}
          icon={CalendarCheck}
          accent={
            pctGlobal == null
              ? "primary"
              : pctGlobal >= 90
                ? "emerald"
                : pctGlobal >= 80
                  ? "amber"
                  : "rose"
          }
        />
        <StatCard
          label="En riesgo"
          value={enRiesgo}
          icon={AlertTriangle}
          accent={enRiesgo === 0 ? "emerald" : "rose"}
        />
        <StatCard
          label="Críticos"
          value={criticos}
          icon={AlertTriangle}
          accent={criticos === 0 ? "emerald" : "rose"}
        />
        <StatCard
          label="En alerta"
          value={alertas}
          icon={BarChart3}
          accent={alertas === 0 ? "emerald" : "amber"}
        />
        <StatCard
          label="Fallas"
          value={fallas}
          icon={Download}
          accent={fallas === 0 ? "emerald" : "amber"}
        />
      </div>

      <Card className="mb-6 overflow-hidden border-border/50 shadow-sm rounded-xl">
        <div className="h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Panorama de riesgo por clase
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="pano-desde" className="sr-only">
                  Desde
                </Label>
                <Input
                  id="pano-desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="h-9 w-40 rounded-lg border-border/60 text-sm"
                />
                <Label htmlFor="pano-hasta" className="sr-only">
                  Hasta
                </Label>
                <Input
                  id="pano-hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="h-9 w-40 rounded-lg border-border/60 text-sm"
                />
                {(desde || hasta) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={limpiarFechas}
                    className="h-9 gap-1 rounded-lg border-border/60 text-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpiar
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={g.length === 0 || alertando}
                onClick={() => void alertarTodos()}
                className="h-9 gap-1.5 rounded-lg border-border/60 text-rose-700"
              >
                {alertando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MailWarning className="h-3.5 w-3.5" />
                )}
                Notificar a todos los en riesgo
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm font-medium">Cargando panorama...</span>
            </div>
          ) : g.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Inbox className="h-6 w-6 opacity-40" />
              </div>
              <span className="text-sm font-medium">Sin clases con registros en el rango.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Clase
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Alumnos
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Asistencia
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Semáforo
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fallas
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Detalle
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gruposSorteados.map((fila, i) => {
                  const nivel = nivelDominante(fila.totales);
                  const abierto = abiertos.has(fila.id);
                  return (
                    <Fragment key={fila.id}>
                      <TableRow
                        key={fila.id}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                          nivel === "critico" && fila.totales.en_riesgo > 0
                            ? "bg-rose-500/5 hover:bg-rose-500/10"
                            : nivel === "alerta" && "bg-amber-500/5 hover:bg-amber-500/10",
                        )}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="font-medium">{fila.materia}</div>
                          <div className="text-xs text-muted-foreground">
                            {fila.codigo_grupo}
                            {fila.periodo ? ` · ${fila.periodo}` : ""}
                            {fila.horario ? ` · ${fila.horario}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="secondary" className="rounded-full px-2.5">
                            {fila.alumnos}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              fila.totales.porcentaje_general == null
                                ? "text-muted-foreground"
                                : fila.totales.porcentaje_general >= 90
                                  ? "text-emerald-600"
                                  : fila.totales.porcentaje_general >= 80
                                    ? "text-amber-600"
                                    : "text-rose-600",
                            )}
                          >
                            {fila.totales.porcentaje_general != null
                              ? `${fila.totales.porcentaje_general}%`
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(["critico", "alerta", "bajo", "sin_registros"] as NivelRiesgo[]).map(
                              (n) =>
                                (fila.totales.niveles[n] ?? 0) > 0 && (
                                  <Badge
                                    key={n}
                                    variant="outline"
                                    className={cn(
                                      "gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                      NIVEL_BADGE[n],
                                    )}
                                  >
                                    <span
                                      className={cn("h-1.5 w-1.5 rounded-full", NIVEL_DOT[n])}
                                    />
                                    {fila.totales.niveles[n]} {NIVEL_LABEL[n].toLowerCase()}
                                  </Badge>
                                ),
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              fila.totales.fallas > 0 ? "text-rose-600" : "text-muted-foreground",
                            )}
                          >
                            {fila.totales.fallas}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSel(fila.id);
                                setAbiertos((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(fila.id)) next.delete(fila.id);
                                  else next.add(fila.id);
                                  return next;
                                });
                              }}
                              className={cn(
                                "h-8 gap-1 rounded-full px-2.5 text-xs",
                                abierto
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {abierto ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              Revisar
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Exportar XLSX"
                              onClick={() =>
                                void descargarExportacion(
                                  `/api/asistencia/reportes/grupo/${fila.id}/exportar?formato=xlsx`,
                                  `${fila.codigo_grupo}-asistencia.xlsx`,
                                )
                              }
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Exportar PDF"
                              onClick={() =>
                                void descargarExportacion(
                                  `/api/asistencia/reportes/grupo/${fila.id}/pdf`,
                                  `${fila.codigo_grupo}-asistencia.pdf`,
                                )
                              }
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {abierto && sel === fila.id && (
                        <TableRow
                          key={`${fila.id}-detalle`}
                          className="bg-muted/20 hover:bg-muted/20"
                        >
                          <TableCell colSpan={6} className="px-4 py-4">
                            <AsistenciaPanel
                              sel={fila.id}
                              grupoLabel={`${fila.codigo_grupo} · ${fila.materia}`}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
