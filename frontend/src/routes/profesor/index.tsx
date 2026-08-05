import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useHashTab } from "@/hooks/use-hash-tab";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Loader2,
  Save,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/profesor/")({
  component: ProfesorPanel,
});

type Grupo = {
  id: number;
  materia: string;
  materia_codigo: string;
  periodo: string;
  horario: string | null;
  alumnos: number;
};

type FilaNota = {
  matricula_id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  nota_1: number | null;
  nota_2: number | null;
  nota_3: number | null;
  examen_final: number | null;
  nota_definitiva: number | null;
  observaciones: string | null;
};

type EstadoAsistencia = "presente" | "ausente" | "tarde" | "excusa";
type RegistroAsistencia = {
  matricula_id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  fecha: string | null;
  estado: EstadoAsistencia | null;
  observacion: string | null;
};

const CAMPOS_NOTA = [
  { key: "nota_1", label: "Nota 1 (25%)" },
  { key: "nota_2", label: "Nota 2 (25%)" },
  { key: "nota_3", label: "Nota 3 (20%)" },
  { key: "examen_final", label: "Examen (30%)" },
] as const;

const ESTADOS_ASISTENCIA: { value: EstadoAsistencia; label: string }[] = [
  { value: "presente", label: "Presente" },
  { value: "ausente", label: "Ausente" },
  { value: "tarde", label: "Tarde" },
  { value: "excusa", label: "Excusa" },
];

const TABS_PROFESOR = ["inicio", "planilla", "asistencia"] as const;

function calcDefinitiva(
  a: number | null,
  b: number | null,
  c: number | null,
  d: number | null,
): number | null {
  if (a == null && b == null && c == null && d == null) return null;
  return (
    Math.round(((a ?? 0) * 0.25 + (b ?? 0) * 0.25 + (c ?? 0) * 0.2 + (d ?? 0) * 0.3) * 100) / 100
  );
}

function GrupoSelector({
  grupos,
  sel,
  onSelect,
}: {
  grupos: Grupo[];
  sel: number | null;
  onSelect: (id: number) => void;
}) {
  const actual = grupos.find((g) => g.id === sel);
  return (
    <Card className="mb-6 border-border/50 shadow-sm rounded-xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          Seleccionar grupo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="grupo" className="sr-only">
            Grupo
          </Label>
          <select
            id="grupo"
            value={sel ?? ""}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="input-field max-w-sm"
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.materia} · {g.periodo}
              </option>
            ))}
          </select>
          {actual && (
            <>
              <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-xs font-medium">
                {actual.alumnos} alumnos
              </Badge>
              {actual.horario && (
                <span className="text-xs text-muted-foreground">{actual.horario}</span>
              )}
            </>
          )}
        </div>
        {grupos.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            No tienes grupos asignados en este periodo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfesorPanel() {
  const [tab, setTab] = useHashTab(TABS_PROFESOR, "inicio");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [planilla, setPlanilla] = useState<FilaNota[]>([]);
  const [asistencia, setAsistencia] = useState<RegistroAsistencia[]>([]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState<number | null>(null);
  const [guardandoAsist, setGuardandoAsist] = useState(false);
  const [cargandoPlanilla, setCargandoPlanilla] = useState(false);
  const [cargandoAsist, setCargandoAsist] = useState(false);

  useEffect(() => {
    api<Grupo[]>("/api/profesor/grupos")
      .then((g) => {
        setGrupos(g);
        if (g[0]) setSel(g[0].id);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Error al cargar grupos"));
  }, []);

  useEffect(() => {
    if (!sel) return;
    setCargandoPlanilla(true);
    api<FilaNota[]>(`/api/notas/grupo/${sel}`)
      .then(setPlanilla)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Error al cargar planilla"))
      .finally(() => setCargandoPlanilla(false));
  }, [sel]);

  useEffect(() => {
    if (!sel) return;
    setCargandoAsist(true);
    api<{ fecha: string; registros: RegistroAsistencia[] }>(
      `/api/asistencia/grupo/${sel}?fecha=${fecha}`,
    )
      .then((d) => setAsistencia(d.registros))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar asistencia"),
      )
      .finally(() => setCargandoAsist(false));
  }, [sel, fecha]);

  const totalAlumnos = grupos.reduce((s, g) => s + g.alumnos, 0);
  const materiasUnicas = new Set(grupos.map((g) => g.materia)).size;

  function actualizarNota(
    id: number,
    campo: "nota_1" | "nota_2" | "nota_3" | "examen_final",
    valor: string,
  ) {
    setPlanilla((prev) =>
      prev.map((f) =>
        f.matricula_id === id ? { ...f, [campo]: valor === "" ? null : Number(valor) } : f,
      ),
    );
  }

  async function guardarNota(f: FilaNota) {
    setGuardando(f.matricula_id);
    try {
      const res = await api<{ nota_definitiva: number | null }>("/api/notas/guardar", {
        method: "POST",
        body: JSON.stringify({
          matricula_id: f.matricula_id,
          nota_1: f.nota_1,
          nota_2: f.nota_2,
          nota_3: f.nota_3,
          examen_final: f.examen_final,
          observaciones: f.observaciones,
        }),
      });
      setPlanilla((prev) =>
        prev.map((x) =>
          x.matricula_id === f.matricula_id ? { ...x, nota_definitiva: res.nota_definitiva } : x,
        ),
      );
      toast.success(`Notas de ${f.estudiante} guardadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar notas");
    } finally {
      setGuardando(null);
    }
  }

  function setEstado(id: number, estado: EstadoAsistencia) {
    setAsistencia((prev) => prev.map((a) => (a.matricula_id === id ? { ...a, estado } : a)));
  }

  async function guardarAsistencia() {
    if (!sel || asistencia.length === 0) return;
    setGuardandoAsist(true);
    try {
      await api("/api/asistencia/registrar", {
        method: "POST",
        body: JSON.stringify({
          grupo_id: sel,
          fecha,
          registros: asistencia.map((a) => ({
            matricula_id: a.matricula_id,
            estado: a.estado ?? "presente",
          })),
        }),
      });
      toast.success(`Asistencia del ${fecha} guardada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar asistencia");
    } finally {
      setGuardandoAsist(false);
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as (typeof TABS_PROFESOR)[number])}
      className="space-y-6"
    >
      <TabsList className="h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
        <TabsTrigger value="inicio" className="gap-1.5 px-4 py-2 rounded-lg">
          <LayoutDashboard className="h-4 w-4" />
          Inicio
        </TabsTrigger>
        <TabsTrigger value="planilla" className="gap-1.5 px-4 py-2 rounded-lg">
          <ClipboardCheck className="h-4 w-4" />
          Planilla de Calificaciones
        </TabsTrigger>
        <TabsTrigger value="asistencia" className="gap-1.5 px-4 py-2 rounded-lg">
          <CalendarDays className="h-4 w-4" />
          Toma de Asistencia
        </TabsTrigger>
      </TabsList>

      {/* Inicio: resumen de grupos asignados */}
      <TabsContent value="inicio" className="space-y-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Grupos asignados"
            value={grupos.length}
            icon={BookOpen}
            accent="emerald"
          />
          <StatCard label="Alumnos en total" value={totalAlumnos} icon={Users} accent="primary" />
          <StatCard label="Materias" value={materiasUnicas} icon={GraduationCap} accent="sky" />
        </div>

        {grupos.length === 0 ? (
          <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Inbox className="h-6 w-6 opacity-40" />
              </div>
              <span className="text-sm font-medium">
                No tienes grupos asignados en este periodo.
              </span>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSel(g.id);
                  setTab("planilla");
                }}
                className={cn(
                  "group cursor-pointer rounded-xl border border-border/50 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                  sel === g.id && "ring-2 ring-primary/30",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                    <BookOpen className="h-5 w-5 text-emerald-600" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {g.alumnos} alumnos
                  </Badge>
                </div>
                <h3 className="mt-3 text-base font-semibold">{g.materia}</h3>
                <p className="text-xs text-muted-foreground">{g.materia_codigo}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-full px-2.5 text-xs font-normal">
                    {g.periodo}
                  </Badge>
                  {g.horario && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {g.horario}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Planilla de Calificaciones */}
      <TabsContent value="planilla">
        <GrupoSelector grupos={grupos} sel={sel} onSelect={setSel} />
        <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
          <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estudiante
                </TableHead>
                {CAMPOS_NOTA.map((c) => (
                  <TableHead
                    key={c.key}
                    className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Definitiva
                </TableHead>
                <TableHead className="px-4 py-3.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargandoPlanilla ? (
                <TableRow>
                  <TableCell colSpan={CAMPOS_NOTA.length + 3} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm font-medium">Cargando planilla...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {planilla.map((f, i) => {
                    const def = calcDefinitiva(f.nota_1, f.nota_2, f.nota_3, f.examen_final);
                    return (
                      <TableRow
                        key={f.matricula_id}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                        )}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="font-medium">{f.estudiante}</div>
                          <div className="text-xs text-muted-foreground">{f.correo}</div>
                        </TableCell>
                        {CAMPOS_NOTA.map((c) => (
                          <TableCell key={c.key} className="px-4 py-3">
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={5}
                              value={f[c.key] ?? ""}
                              onChange={(e) =>
                                actualizarNota(f.matricula_id, c.key, e.target.value)
                              }
                              className="w-20 h-9 rounded-lg border-border/60 text-center text-sm font-medium focus-visible:ring-primary/30"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              def == null
                                ? "bg-muted text-muted-foreground"
                                : def >= 3
                                  ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                                  : "border-rose-200 bg-rose-500/10 text-rose-700",
                            )}
                          >
                            {def != null ? def.toFixed(2) : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            disabled={guardando === f.matricula_id}
                            onClick={() => guardarNota(f)}
                            className="gap-1 h-8 rounded-lg"
                          >
                            {guardando === f.matricula_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Guardar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {planilla.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={CAMPOS_NOTA.length + 3} className="h-40 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <Inbox className="h-6 w-6 opacity-40" />
                          </div>
                          <span className="text-sm font-medium">
                            {sel
                              ? "Sin alumnos matriculados en este grupo."
                              : "Selecciona un grupo para ver la planilla."}
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
      </TabsContent>

      {/* Toma de Asistencia */}
      <TabsContent value="asistencia">
        <GrupoSelector grupos={grupos} sel={sel} onSelect={setSel} />
        <Card className="mb-4 border-border/50 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                Asistencia del día
              </span>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-auto h-9 rounded-lg border-border/60 text-sm"
                />
                <Button
                  size="sm"
                  onClick={guardarAsistencia}
                  disabled={guardandoAsist || asistencia.length === 0}
                  className="gap-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  {guardandoAsist ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Guardar asistencia
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estudiante
                </TableHead>
                <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargandoAsist ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm font-medium">Cargando asistencia...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {asistencia.map((a, i) => (
                    <TableRow
                      key={a.matricula_id}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                      )}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="font-medium">{a.estudiante}</div>
                        <div className="text-xs text-muted-foreground">{a.correo}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <RadioGroup
                          value={a.estado ?? "presente"}
                          onValueChange={(v) => setEstado(a.matricula_id, v as EstadoAsistencia)}
                          className="flex flex-wrap gap-x-4 gap-y-1"
                        >
                          {ESTADOS_ASISTENCIA.map((e) => (
                            <div key={e.value} className="flex items-center gap-1.5">
                              <RadioGroupItem
                                value={e.value}
                                id={`${a.matricula_id}-${e.value}`}
                                className="h-4 w-4"
                              />
                              <Label
                                htmlFor={`${a.matricula_id}-${e.value}`}
                                className="cursor-pointer text-xs font-normal text-muted-foreground"
                              >
                                {e.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                  {asistencia.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="h-40 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <Inbox className="h-6 w-6 opacity-40" />
                          </div>
                          <span className="text-sm font-medium">
                            {sel
                              ? "Sin alumnos matriculados en este grupo."
                              : "Selecciona un grupo para tomar asistencia."}
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
      </TabsContent>
    </Tabs>
  );
}
