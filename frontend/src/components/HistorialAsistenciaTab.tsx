import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, CalendarCheck, Clock, Inbox, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

type FilaResumen = {
  estudiante_id: number;
  estudiante: string;
  correo: string;
  foto_url: string | null;
  presentes: number;
  ausentes: number;
  tardes: number;
  excusas: number;
  total: number;
  fallas: number;
  porcentaje: number | null;
};

const UMBRAL_RIESGO = 80;

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function HistorialAsistenciaTab({ sel }: { sel: number | null }) {
  const [filas, setFilas] = useState<FilaResumen[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!sel) return;
    let activo = true;
    setCargando(true);
    api<{ estudiantes: FilaResumen[] }>(`/api/asistencia/resumen/grupo/${sel}`)
      .then((d) => {
        if (activo) setFilas(d.estudiantes);
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
  }, [sel]);

  const totalRegistros = filas.reduce((s, f) => s + f.total, 0);
  const presentesTotales = filas.reduce((s, f) => s + f.presentes, 0);
  const pctPromedio =
    totalRegistros > 0 ? Math.round((presentesTotales / totalRegistros) * 100) : 0;
  const enRiesgo = filas.filter((f) => f.porcentaje != null && f.porcentaje < UMBRAL_RIESGO).length;
  const fallasTotales = filas.reduce((s, f) => s + f.fallas, 0);

  // Riesgo primero: menor porcentaje arriba; sin registros al final.
  const ordenadas = [...filas].sort((a, b) => {
    if (a.porcentaje == null && b.porcentaje == null)
      return a.estudiante.localeCompare(b.estudiante);
    if (a.porcentaje == null) return 1;
    if (b.porcentaje == null) return -1;
    return a.porcentaje - b.porcentaje || a.estudiante.localeCompare(b.estudiante);
  });

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Asistencia promedio"
          value={`${pctPromedio}%`}
          icon={CalendarCheck}
          accent={pctPromedio >= UMBRAL_RIESGO ? "emerald" : pctPromedio >= 60 ? "amber" : "rose"}
        />
        <StatCard
          label={`En riesgo (<${UMBRAL_RIESGO}%)`}
          value={enRiesgo}
          icon={AlertTriangle}
          accent={enRiesgo === 0 ? "emerald" : enRiesgo <= 2 ? "amber" : "rose"}
        />
        <StatCard
          label="Fallas totales"
          value={fallasTotales}
          icon={BarChart3}
          accent={fallasTotales === 0 ? "emerald" : fallasTotales <= 5 ? "amber" : "rose"}
        />
        <StatCard label="Registros" value={totalRegistros} icon={Clock} accent="sky" />
      </div>

      <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Resumen histórico por estudiante
          </CardTitle>
        </CardHeader>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm font-medium">Cargando resumen...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {ordenadas.map((f, i) => {
                  const riesgo = f.porcentaje != null && f.porcentaje < UMBRAL_RIESGO;
                  return (
                    <TableRow
                      key={f.estudiante_id}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                        riesgo && "bg-rose-500/5 hover:bg-rose-500/10",
                      )}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border/60">
                            {f.foto_url ? (
                              <AvatarImage src={f.foto_url} alt={f.estudiante} />
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
                            {f.presentes} presentes
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-full border-rose-200 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700"
                          >
                            {f.ausentes} ausentes
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-full border-amber-200 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          >
                            {f.tardes} tardes
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-full border-sky-200 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700"
                          >
                            {f.excusas} excusas
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
                        <div className="min-w-[160px] space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                f.porcentaje == null
                                  ? "border-border bg-muted text-muted-foreground"
                                  : riesgo
                                    ? "border-rose-200 bg-rose-500/10 text-rose-700"
                                    : "border-emerald-200 bg-emerald-500/10 text-emerald-700",
                              )}
                            >
                              {f.porcentaje != null ? `${f.porcentaje}%` : "Sin registros"}
                            </Badge>
                            {riesgo && (
                              <span className="text-xs font-medium text-rose-600">En riesgo</span>
                            )}
                          </div>
                          <Progress
                            value={f.porcentaje ?? 0}
                            className={cn("h-2", riesgo && "bg-rose-500/20")}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                          <Inbox className="h-6 w-6 opacity-40" />
                        </div>
                        <span className="text-sm font-medium">
                          {sel
                            ? "Sin alumnos matriculados en este grupo."
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
      </Card>
    </>
  );
}
