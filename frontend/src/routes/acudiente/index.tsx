import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useHashTab } from "@/hooks/use-hash-tab";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  HeartHandshake,
  BookOpen,
  Award,
  CalendarCheck,
  Printer,
  Inbox,
  GraduationCap,
  LayoutDashboard,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/acudiente/")({
  component: AcudientePanel,
});

type Hijo = {
  estudiante_id: number;
  estudiante: string;
  correo: string;
};

type FilaNota = {
  grupo_id: number;
  periodo: string;
  horario: string | null;
  materia: string;
  materia_codigo: string;
  nota_1: number | null;
  nota_2: number | null;
  nota_3: number | null;
  examen_final: number | null;
  nota_definitiva: number | null;
  observaciones: string | null;
};

type RegistroAsistencia = {
  fecha: string;
  estado: "presente" | "ausente" | "tarde" | "excusa";
  observacion: string | null;
  materia: string;
};

type Resumen = {
  estudiante: { id: number; nombre: string; correo: string; foto_url: string | null };
  notas: FilaNota[];
  asistencia: RegistroAsistencia[];
  promedio: number | null;
  materias_cursadas: number;
};

const estadoAsistencia: Record<RegistroAsistencia["estado"], string> = {
  presente: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  ausente: "border-rose-200 bg-rose-500/10 text-rose-700",
  tarde: "border-amber-200 bg-amber-500/10 text-amber-700",
  excusa: "border-sky-200 bg-sky-500/10 text-sky-700",
};

const estadoLabel: Record<RegistroAsistencia["estado"], string> = {
  presente: "Presente",
  ausente: "Ausente",
  tarde: "Tarde",
  excusa: "Excusa",
};

function fmtFecha(v: string): string {
  try {
    return format(new Date(v), "d MMM yyyy", { locale: es });
  } catch {
    return v;
  }
}

const TABS_ACUDIENTE = ["inicio", "resumen"] as const;

function AcudientePanel() {
  const [tab, setTab] = useHashTab(TABS_ACUDIENTE, "inicio");
  const [hijos, setHijos] = useState<Hijo[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api<Hijo[]>("/api/acudiente/estudiantes")
      .then((h) => {
        setHijos(h);
        if (h[0]) setSel(h[0].estudiante_id);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar estudiantes"),
      );
  }, []);

  useEffect(() => {
    if (sel == null) return;
    let activo = true;
    setCargando(true);
    api<Resumen>(`/api/acudiente/resumen/${sel}`)
      .then((r) => {
        if (activo) setResumen(r);
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "Error al cargar el resumen");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [sel]);

  const hijoActual = hijos.find((h) => h.estudiante_id === sel);
  const presentes = resumen?.asistencia.filter((a) => a.estado === "presente").length ?? 0;
  const ausencias = resumen?.asistencia.filter((a) => a.estado === "ausente").length ?? 0;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight">Seguimiento académico</h2>
        <p className="text-sm text-muted-foreground">
          Notas, asistencia y boletín de los estudiantes a tu cargo
        </p>
      </div>

      <Card className="mb-6 border-border/50 shadow-sm rounded-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
        <CardContent className="p-5">
          <Label htmlFor="hijo" className="mb-2 block text-sm font-medium">
            Selecciona un estudiante
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="hijo"
              value={sel ?? ""}
              onChange={(e) => setSel(Number(e.target.value))}
              className="input-field max-w-sm"
            >
              {hijos.map((h) => (
                <option key={h.estudiante_id} value={h.estudiante_id}>
                  {h.estudiante}
                </option>
              ))}
            </select>
            {hijoActual && (
              <span className="text-xs text-muted-foreground">{hijoActual.correo}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="ml-auto gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Imprimir boletín
            </Button>
          </div>
          {hijos.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No tienes estudiantes vinculados. Pídele al administrador que te vincule con un
              estudiante.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS_ACUDIENTE)[number])}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
          <TabsTrigger value="inicio" className="gap-1.5 px-4 py-2 rounded-lg">
            <LayoutDashboard className="h-4 w-4" />
            Inicio
          </TabsTrigger>
          <TabsTrigger value="resumen" className="gap-1.5 px-4 py-2 rounded-lg">
            <BarChart3 className="h-4 w-4" />
            Resumen completo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inicio" className="space-y-6">
          {resumen && (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Promedio general"
                  value={resumen.promedio != null ? resumen.promedio.toFixed(2) : "—"}
                  icon={Award}
                  accent={resumen.promedio != null && resumen.promedio >= 3 ? "emerald" : "rose"}
                />
                <StatCard
                  label="Materias cursadas"
                  value={resumen.materias_cursadas}
                  icon={BookOpen}
                  accent="primary"
                />
                <StatCard
                  label="Asistencias presentes"
                  value={presentes}
                  icon={CalendarCheck}
                  accent="sky"
                />
                <StatCard
                  label="Ausencias"
                  value={ausencias}
                  icon={HeartHandshake}
                  accent="amber"
                />
              </div>

              <Card className="mb-6 overflow-hidden border-border/50 shadow-sm rounded-xl">
                <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Resumen rápido de notas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {resumen.notas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este estudiante no tiene materias matriculadas.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {resumen.notas.map((n) => {
                        const def = n.nota_definitiva;
                        return (
                          <div
                            key={`${n.grupo_id}-${n.periodo}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{n.materia}</p>
                              <p className="text-xs text-muted-foreground">{n.periodo}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                def == null
                                  ? "bg-muted text-muted-foreground"
                                  : def >= 3
                                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                                    : "border-rose-200 bg-rose-500/10 text-rose-700",
                              )}
                            >
                              {def != null ? Number(def).toFixed(2) : "—"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="resumen" className="space-y-6">
          {resumen && (
            <>
              <Card className="mb-6 overflow-hidden border-border/50 shadow-sm rounded-xl">
                <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Boletín de notas
                  </CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Materia
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Periodo
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Nota 1
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Nota 2
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Nota 3
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Final
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Definitiva
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.notas.map((n, i) => {
                      const def = n.nota_definitiva;
                      return (
                        <TableRow
                          key={`${n.grupo_id}-${n.periodo}`}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                          )}
                        >
                          <TableCell className="px-4 py-3">
                            <div className="font-medium">{n.materia}</div>
                            <div className="text-xs text-muted-foreground">
                              {n.materia_codigo}
                              {n.horario ? ` · ${n.horario}` : ""}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="rounded-full px-2.5 text-xs font-normal"
                            >
                              {n.periodo}
                            </Badge>
                          </TableCell>
                          {[n.nota_1, n.nota_2, n.nota_3, n.examen_final].map((x, j) => (
                            <TableCell key={j} className="px-4 py-3">
                              {x != null ? (
                                Number(x).toFixed(2)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2.5 text-xs font-semibold",
                                def == null
                                  ? "bg-muted text-muted-foreground"
                                  : def >= 3
                                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                                    : "border-rose-200 bg-rose-500/10 text-rose-700",
                              )}
                            >
                              {def != null ? Number(def).toFixed(2) : "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {resumen.notas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                              <Inbox className="h-6 w-6 opacity-40" />
                            </div>
                            <span className="text-sm font-medium">
                              Este estudiante no tiene materias matriculadas.
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
                <div className="h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarCheck className="h-5 w-5 text-sky-600" />
                    Historial de asistencia
                  </CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Fecha
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Materia
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Estado
                      </TableHead>
                      <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Observación
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.asistencia.map((a, i) => (
                      <TableRow
                        key={`${a.materia}-${a.fecha}`}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                        )}
                      >
                        <TableCell className="px-4 py-3">{fmtFecha(a.fecha)}</TableCell>
                        <TableCell className="px-4 py-3">{a.materia}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 text-xs font-medium",
                              estadoAsistencia[a.estado],
                            )}
                          >
                            {estadoLabel[a.estado]}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {a.observacion ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {resumen.asistencia.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                              <Inbox className="h-6 w-6 opacity-40" />
                            </div>
                            <span className="text-sm font-medium">
                              Sin registros de asistencia.
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {!resumen && !cargando && sel != null && (
        <p className="text-sm text-muted-foreground">
          Selecciona un estudiante para ver su boletín.
        </p>
      )}
    </>
  );
}
