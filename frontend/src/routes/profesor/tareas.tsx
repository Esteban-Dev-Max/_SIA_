import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BookOpen,
  Plus,
  Loader2,
  Save,
  Eye,
  ClipboardList,
  Users,
  FileText,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/profesor/tareas")({
  component: ProfesorTareas,
});

type Grupo = {
  id: number;
  materia: string;
  materia_codigo: string;
  periodo: string;
  horario: string | null;
  alumnos: number;
};

type TareaGrupo = {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha_entrega: string | null;
  puntaje_max: number | string;
  materia: string;
  periodo: string;
  total_alumnos: number | string;
  entregados: number | string;
};

type Entrega = {
  entrega_id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  archivo_url: string | null;
  fecha_entrega: string | null;
  calificacion: number | string | null;
  comentario: string | null;
  retroalimentacion: string | null;
};

type DetalleTarea = {
  tarea: { id: number; titulo: string; puntaje_max: number | string };
  total_alumnos: number | string;
  entregas: Entrega[];
  sin_entrega: { estudiante_id: number; estudiante: string; correo: string }[];
};

function fmtFecha(v: string | null): string {
  if (!v) return "—";
  try {
    return format(new Date(v), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return v;
  }
}

function num(v: number | string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ProfesorTareas() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [tareas, setTareas] = useState<TareaGrupo[]>([]);
  const [cargando, setCargando] = useState(false);

  const [openNueva, setOpenNueva] = useState(false);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    fecha_entrega: "",
    puntaje_max: "10",
  });

  const [revTarea, setRevTarea] = useState<TareaGrupo | null>(null);
  const [detalle, setDetalle] = useState<DetalleTarea | null>(null);
  const [cargandoRev, setCargandoRev] = useState(false);
  const [guardandoCalif, setGuardandoCalif] = useState<number | null>(null);

  useEffect(() => {
    api<Grupo[]>("/api/profesor/grupos")
      .then((g) => {
        setGrupos(g);
        if (g[0]) setSel(g[0].id);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Error al cargar grupos"));
  }, []);

  const cargarTareas = useCallback(async () => {
    if (!sel) return;
    setCargando(true);
    try {
      const data = await api<TareaGrupo[]>(`/api/tareas/grupo/${sel}`);
      setTareas(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar tareas");
    } finally {
      setCargando(false);
    }
  }, [sel]);

  useEffect(() => {
    cargarTareas();
  }, [cargarTareas]);

  const grupoActual = grupos.find((g) => g.id === sel);

  async function crearTarea() {
    if (!form.titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setCreando(true);
    try {
      await api("/api/tareas", {
        method: "POST",
        body: JSON.stringify({
          grupo_id: sel,
          titulo: form.titulo,
          descripcion: form.descripcion,
          fecha_entrega: form.fecha_entrega || null,
          puntaje_max: form.puntaje_max || "10",
        }),
      });
      toast.success("Tarea creada");
      setOpenNueva(false);
      setForm({ titulo: "", descripcion: "", fecha_entrega: "", puntaje_max: "10" });
      cargarTareas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear tarea");
    } finally {
      setCreando(false);
    }
  }

  async function abrirRevision(t: TareaGrupo) {
    setRevTarea(t);
    setDetalle(null);
    setCargandoRev(true);
    try {
      const d = await api<DetalleTarea>(`/api/tareas/${t.id}/entregas`);
      setDetalle(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar entregas");
    } finally {
      setCargandoRev(false);
    }
  }

  function actualizarEntrega(
    entregaId: number,
    campo: "calificacion" | "retroalimentacion",
    valor: string,
  ) {
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            entregas: prev.entregas.map((e) =>
              e.entrega_id === entregaId ? { ...e, [campo]: valor } : e,
            ),
          }
        : prev,
    );
  }

  async function guardarCalificacion(e: Entrega) {
    setGuardandoCalif(e.entrega_id);
    try {
      await api(`/api/tareas/calificar/${e.entrega_id}`, {
        method: "POST",
        body: JSON.stringify({
          calificacion: e.calificacion,
          retroalimentacion: e.retroalimentacion,
        }),
      });
      toast.success(`Calificación de ${e.estudiante} guardada`);
      cargarTareas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar calificación");
    } finally {
      setGuardandoCalif(null);
    }
  }

  return (
    <>
      {/* Selector de grupo */}
      <Card className="mb-6 border-border/50 shadow-sm rounded-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-violet-600" />
            Gestión de tareas por grupo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="grupo" className="sr-only">
                Grupo
              </Label>
              <select
                id="grupo"
                value={sel ?? ""}
                onChange={(e) => setSel(Number(e.target.value))}
                className="input-field max-w-sm"
              >
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.materia} · {g.periodo}
                  </option>
                ))}
              </select>
              {grupoActual && (
                <span className="text-xs text-muted-foreground">{grupoActual.horario}</span>
              )}
            </div>
            <Button
              onClick={() => setOpenNueva(true)}
              disabled={!sel}
              className="gap-1.5 rounded-lg shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nueva tarea
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de tareas */}
      <DataTable
        loading={cargando}
        loadingMessage="Cargando tareas..."
        headers={["Título", "Materia", "Fecha límite", "Puntaje", "Entregas", ""]}
        rows={tareas.map((t) => {
          const e = Number(t.entregados);
          const total = Number(t.total_alumnos);
          return [
            <div key="t" className="min-w-0">
              <div className="font-medium leading-snug">{t.titulo}</div>
              {t.descripcion && (
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {t.descripcion}
                </div>
              )}
            </div>,
            <Badge key="m" variant="outline" className="text-xs font-normal rounded-full px-2.5">
              {t.materia}
            </Badge>,
            <span key="f" className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {fmtFecha(t.fecha_entrega)}
            </span>,
            <span key="p" className="font-semibold">
              {num(t.puntaje_max)?.toFixed(1) ?? "—"}
            </span>,
            <Badge
              key="ent"
              variant="outline"
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                e >= total && total > 0
                  ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                  : "border-amber-200 bg-amber-500/10 text-amber-700",
              )}
            >
              {e}/{total} entregadas
            </Badge>,
            <Button
              key="rev"
              size="sm"
              variant="outline"
              onClick={() => abrirRevision(t)}
              className="gap-1.5 h-8 rounded-lg"
            >
              <Eye className="h-3.5 w-3.5" />
              Revisar
            </Button>,
          ];
        })}
        emptyMessage="No hay tareas creadas para este grupo."
      />

      {/* Modal crear tarea */}
      <Dialog open={openNueva} onOpenChange={setOpenNueva}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-violet-600" />
              Nueva tarea
            </DialogTitle>
            <DialogDescription>
              {grupoActual
                ? `Para ${grupoActual.materia} · ${grupoActual.periodo}`
                : "Selecciona un grupo para crear la tarea."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej. Taller 2: Bucles en Python"
                className="rounded-lg border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea
                id="desc"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Instrucciones, entregables y criterios de evaluación…"
                className="rounded-lg border-border/60"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de entrega</Label>
                <Input
                  id="fecha"
                  type="datetime-local"
                  value={form.fecha_entrega}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_entrega: e.target.value }))}
                  className="rounded-lg border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="puntaje">Puntaje máximo</Label>
                <Input
                  id="puntaje"
                  type="number"
                  min={1}
                  step="0.5"
                  value={form.puntaje_max}
                  onChange={(e) => setForm((f) => ({ ...f, puntaje_max: e.target.value }))}
                  className="rounded-lg border-border/60"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNueva(false)}>
              Cancelar
            </Button>
            <Button onClick={crearTarea} disabled={creando} className="gap-1.5 rounded-lg">
              {creando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal revisión y calificación */}
      <Dialog open={revTarea !== null} onOpenChange={(v) => !v && setRevTarea(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              {revTarea?.titulo ?? ""}
            </DialogTitle>
            <DialogDescription>
              {revTarea
                ? `${revTarea.materia} · Puntaje máximo ${num(revTarea.puntaje_max)?.toFixed(1)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {cargandoRev && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando entregas…
            </div>
          )}

          {!cargandoRev && detalle && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-violet-200 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                >
                  <Users className="mr-1 h-3 w-3" />
                  {detalle.entregas.length} de {detalle.total_alumnos} entregaron
                </Badge>
                {detalle.sin_entrega.length > 0 && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-200 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                  >
                    {detalle.sin_entrega.length} pendientes
                  </Badge>
                )}
              </div>

              {/* Entregas */}
              <div className="space-y-3">
                {detalle.entregas.map((e) => (
                  <div
                    key={e.entrega_id}
                    className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{e.estudiante}</p>
                        <p className="text-xs text-muted-foreground">{e.correo}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {e.archivo_url && (
                          <a
                            href={e.archivo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Ver archivo
                          </a>
                        )}
                        <span>· {fmtFecha(e.fecha_entrega)}</span>
                      </div>
                    </div>
                    {e.comentario && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Comentario:</span> {e.comentario}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Calificación (máx {num(revTarea?.puntaje_max ?? null)?.toFixed(0)})
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={num(revTarea?.puntaje_max ?? null) ?? undefined}
                          step="0.1"
                          value={e.calificacion ?? ""}
                          onChange={(ev) =>
                            actualizarEntrega(e.entrega_id, "calificacion", ev.target.value)
                          }
                          className="h-9 rounded-lg border-border/60 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Retroalimentación</Label>
                        <Input
                          value={e.retroalimentacion ?? ""}
                          onChange={(ev) =>
                            actualizarEntrega(e.entrega_id, "retroalimentacion", ev.target.value)
                          }
                          placeholder="Comentario para el estudiante…"
                          className="h-9 rounded-lg border-border/60 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => guardarCalificacion(e)}
                        disabled={guardandoCalif === e.entrega_id}
                        className="gap-1.5 h-8 rounded-lg"
                      >
                        {guardandoCalif === e.entrega_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                ))}
                {detalle.entregas.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay entregas para esta tarea.
                  </p>
                )}
              </div>

              {/* Sin entregar */}
              {detalle.sin_entrega.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-amber-700">
                    Estudiantes sin entregar
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detalle.sin_entrega.map((s) => (
                      <Badge
                        key={s.estudiante_id}
                        variant="outline"
                        className="rounded-full text-xs font-normal"
                      >
                        {s.estudiante}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
