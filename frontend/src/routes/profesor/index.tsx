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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AsistenciaPanel } from "@/components/AsistenciaPanel";
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
  codigo_grupo: string;
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

const CAMPOS_NOTA = [
  { key: "nota_1", label: "Nota 1 (25%)" },
  { key: "nota_2", label: "Nota 2 (25%)" },
  { key: "nota_3", label: "Nota 3 (20%)" },
  { key: "examen_final", label: "Examen (30%)" },
] as const;

const TABS_PROFESOR = ["inicio", "planilla", "asistencia"] as const;

const NOTA_MIN = 1;
const NOTA_MAX = 5;

type CampoNota = "nota_1" | "nota_2" | "nota_3" | "examen_final";

// Fila de la planilla en la UI: las notas se guardan como texto crudo (lo que
// digita el profesor, aceptando punto o coma) y los números se derivan al
// calcular la definitiva o al guardar.
type FilaPlanilla = Omit<FilaNota, CampoNota> & Record<CampoNota, string>;

/** Sanitiza mientras se escribe: coma→punto, solo dígitos y un separador,
 * máx 2 decimales y tope inmediato en NOTA_MAX (p. ej. 50, 500 o 10 → 5).
 * Los negativos se descartan por completo. */
function filtrarNota(raw: string): string {
  if (raw.includes("-")) return "";
  let s = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const i = s.indexOf(".");
  if (i !== -1) {
    s =
      s.slice(0, i + 1) +
      s
        .slice(i + 1)
        .replace(/\./g, "")
        .slice(0, 2);
  }
  s = s.replace(/^0+(?=\d)/, "");
  if (s && Number(s.replace(/\.$/, "")) > NOTA_MAX) {
    s = String(NOTA_MAX);
  }
  return s;
}

/** Texto → número; null si está vacío o es inválido (p. ej. "." a secas). */
function notaDeTexto(texto: string): number | null {
  const t = texto.trim();
  if (!t || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Vacío cuenta como válido (permite limpiar una nota); lo demás debe estar en rango. */
function notaValida(texto: string): boolean {
  const n = notaDeTexto(texto);
  return n === null || (n >= NOTA_MIN && n <= NOTA_MAX);
}

function filaATexto(f: FilaNota): FilaPlanilla {
  return {
    ...f,
    nota_1: f.nota_1?.toString() ?? "",
    nota_2: f.nota_2?.toString() ?? "",
    nota_3: f.nota_3?.toString() ?? "",
    examen_final: f.examen_final?.toString() ?? "",
  };
}

function calcDefinitiva(...campos: string[]): number | null {
  // Mismo criterio que el backend (lib/notas.js): la definitiva solo se
  // muestra/cuenta cuando las 4 notas están completas y en rango [0, 5].
  // El mínimo es 0 (no 1) para que las columnas sincronizadas desde tareas
  // (que pueden quedar por debajo de 1 en la escala 0.0–5.0) cuenten igual.
  const notas: number[] = [];
  for (const t of campos) {
    const n = notaDeTexto(t);
    if (n === null || n < 0 || n > NOTA_MAX) return null;
    notas.push(n);
  }
  // Epsilon para que coincida con lib/notas.js del backend (3.975 -> 3.98).
  const total = notas[0] * 0.25 + notas[1] * 0.25 + notas[2] * 0.2 + notas[3] * 0.3;
  return Math.round((total + 1e-9) * 100) / 100;
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
          Seleccionar clase
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="grupo" className="sr-only">
            Clase
          </Label>
          <select
            id="grupo"
            value={sel ?? ""}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="input-field max-w-sm"
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.codigo_grupo} · {g.materia} · {g.periodo}
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
          <p className="text-sm text-muted-foreground">
            No tienes clases asignadas en este periodo.
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
  const [planilla, setPlanilla] = useState<FilaPlanilla[]>([]);
  const [columnasTareas, setColumnasTareas] = useState<CampoNota[]>([]);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [cargandoPlanilla, setCargandoPlanilla] = useState(false);

  useEffect(() => {
    api<Grupo[]>("/api/profesor/grupos")
      .then((g) => {
        setGrupos(g);
        if (g[0]) setSel(g[0].id);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Error al cargar clases"));
  }, []);

  useEffect(() => {
    if (!sel) return;
    let activo = true;
    setCargandoPlanilla(true);
    api<{ filas: FilaNota[]; columnas_tareas: CampoNota[] }>(`/api/notas/grupo/${sel}`)
      .then((d) => {
        if (activo) {
          setColumnasTareas(d.columnas_tareas);
          setPlanilla(d.filas.map(filaATexto));
        }
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "Error al cargar planilla");
      })
      .finally(() => {
        if (activo) setCargandoPlanilla(false);
      });
    return () => {
      activo = false;
    };
  }, [sel]);

  const totalAlumnos = grupos.reduce((s, g) => s + g.alumnos, 0);
  const materiasUnicas = new Set(grupos.map((g) => g.materia)).size;

  function actualizarNota(id: number, campo: CampoNota, valor: string) {
    setPlanilla((prev) => prev.map((f) => (f.matricula_id === id ? { ...f, [campo]: valor } : f)));
  }

  // Al salir del campo: ajusta al rango válido (500→5, 0.3→1), canoniza el
  // separador a punto y limpia los textos que no se pueden interpretar.
  function normalizarNotaAlSalir(id: number, campo: CampoNota, valor: string) {
    let texto = valor.trim();
    const n = notaDeTexto(texto);
    if (texto && n === null) {
      texto = "";
    } else if (n !== null) {
      const ajustada = Math.min(NOTA_MAX, Math.max(NOTA_MIN, Math.round(n * 100) / 100));
      texto = String(ajustada);
    }
    setPlanilla((prev) => prev.map((f) => (f.matricula_id === id ? { ...f, [campo]: texto } : f)));
  }

  async function guardarNota(f: FilaPlanilla) {
    // Las columnas gestionadas por tareas se ignoran: su valor lo fija el
    // promedio de tareas (puede estar por debajo de 1 y no pasa por la
    // validación manual de rango 1–5 del backend).
    const gestionada = (c: (typeof CAMPOS_NOTA)[number]) => columnasTareas.includes(c.key);
    for (const c of CAMPOS_NOTA) {
      if (gestionada(c)) continue;
      if (!notaValida(f[c.key])) {
        toast.error(`Las notas deben estar entre ${NOTA_MIN} y ${NOTA_MAX}, con máx. 2 decimales`);
        return;
      }
    }
    const body: Record<string, unknown> = {
      matricula_id: f.matricula_id,
      observaciones: f.observaciones,
    };
    for (const c of CAMPOS_NOTA) {
      if (!gestionada(c)) body[c.key] = notaDeTexto(f[c.key]);
    }
    setGuardando(f.matricula_id);
    try {
      const res = await api<{ nota_definitiva: number | null }>("/api/notas/guardar", {
        method: "POST",
        body: JSON.stringify(body),
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
          Asistencia
        </TabsTrigger>
      </TabsList>

      {/* Inicio: resumen de clases asignadas */}
      <TabsContent value="inicio" className="space-y-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Clases asignadas"
            value={grupos.length}
            icon={BookOpen}
            accent="emerald"
          />
          <StatCard label="Alumnos en total" value={totalAlumnos} icon={Users} accent="primary" />
          <StatCard label="Asignaturas" value={materiasUnicas} icon={GraduationCap} accent="sky" />
        </div>

        {grupos.length === 0 ? (
          <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Inbox className="h-6 w-6 opacity-40" />
              </div>
              <span className="text-sm font-medium">
                No tienes clases asignadas en este periodo.
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
                <Badge
                  variant="outline"
                  className="mt-2 rounded-full bg-primary/5 px-2.5 text-xs font-semibold text-primary"
                >
                  {g.codigo_grupo}
                </Badge>
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
                        {CAMPOS_NOTA.map((c) => {
                          const invalida = !notaValida(f[c.key]);
                          const gestionada = columnasTareas.includes(c.key);
                          return (
                            <TableCell key={c.key} className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]+([.,][0-9]{1,2})?"
                                  min={NOTA_MIN}
                                  max={NOTA_MAX}
                                  step="0.1"
                                  disabled={gestionada}
                                  aria-invalid={invalida}
                                  title={
                                    gestionada
                                      ? "Este casillero se actualiza con el promedio de tareas"
                                      : invalida
                                        ? `Debe estar entre ${NOTA_MIN}.0 y ${NOTA_MAX}.0`
                                        : undefined
                                  }
                                  value={f[c.key]}
                                  placeholder={gestionada ? "—" : undefined}
                                  onChange={(e) =>
                                    actualizarNota(
                                      f.matricula_id,
                                      c.key,
                                      filtrarNota(e.target.value),
                                    )
                                  }
                                  onBlur={(e) =>
                                    normalizarNotaAlSalir(f.matricula_id, c.key, e.target.value)
                                  }
                                  className={cn(
                                    "w-20 h-9 rounded-lg border-border/60 text-center text-sm font-medium focus-visible:ring-primary/30",
                                    gestionada &&
                                      "border-violet-200 bg-violet-500/5 text-violet-800 cursor-default",
                                    invalida &&
                                      "border-rose-400 bg-rose-500/5 focus-visible:ring-rose-300",
                                  )}
                                />
                                {gestionada && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-violet-200 bg-violet-500/10 px-2 py-0 text-[10px] font-medium text-violet-700"
                                  >
                                    Promedio tareas
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
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
                              ? "Sin alumnos matriculados en esta clase."
                              : "Selecciona una clase para ver la planilla."}
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

      {/* Asistencia: toma + resumen/reportes (hub con pestañas internas) */}
      <TabsContent value="asistencia">
        <GrupoSelector grupos={grupos} sel={sel} onSelect={setSel} />
        <AsistenciaPanel
          sel={sel}
          grupoLabel={
            grupos.find((g) => g.id === sel)
              ? `${grupos.find((g) => g.id === sel)!.codigo_grupo} · ${
                  grupos.find((g) => g.id === sel)!.materia
                }`
              : undefined
          }
        />
      </TabsContent>
    </Tabs>
  );
}
