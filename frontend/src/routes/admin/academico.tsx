import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useHashTab } from "@/hooks/use-hash-tab";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Search,
  School,
  BookOpen,
  Layers,
  ClipboardList,
  ClipboardCheck,
  HeartHandshake,
  Plus,
  Trash2,
  Link2,
  Check,
  ChevronsUpDown,
  Pencil,
  Loader2,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/admin/academico")({
  component: AdminAcademico,
});

type Grado = { id: number; nombre: string; nivel: string; orden: number };
type Asignatura = {
  id: number;
  nombre: string;
  codigo: string | null;
  grado_id: number | null;
  grado_nombre: string | null;
  grado_nivel: string | null;
};
type Curso = {
  id: number;
  grado_id: number;
  nombre: string;
  ano_lectivo: number;
  grado_nombre: string;
  grado_nivel: string;
  director_id: number | null;
  director: string | null;
  alumnos: number;
};
type Asignacion = {
  id: number;
  curso_id: number;
  asignatura_id: number;
  periodo: string;
  horario: string | null;
  curso: string;
  ano_lectivo: number;
  asignatura: string;
  asignatura_codigo: string | null;
  docente_id: number;
  docente: string | null;
  alumnos: number;
};
type Matricula = {
  id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  curso_id: number;
  curso: string;
  ano_lectivo: number;
  grado_nivel: string;
  fecha_matricula: string;
  asignaturas: number;
};
type Usuario = { id: number; nombre_completo: string; correo: string; rol: string };
type Vinculo = {
  id: number;
  acudiente_id: number;
  acudiente: string;
  acudiente_correo: string;
  estudiante_id: number;
  estudiante: string;
  estudiante_correo: string;
};

const TABS_ACADEMICO = [
  "grados",
  "asignaturas",
  "cursos",
  "asignaciones",
  "matriculas",
  "acudientes",
] as const;

const NIVELES = [
  { value: "preescolar", label: "Preescolar" },
  { value: "primaria", label: "Primaria" },
  { value: "secundaria", label: "Secundaria" },
  { value: "media", label: "Media" },
] as const;

const ANO_ACTUAL = new Date().getFullYear();
const PERIODO_ACTUAL = `${ANO_ACTUAL}-P1`;

function nombreNivel(nivel: string | null) {
  return NIVELES.find((n) => n.value === nivel)?.label ?? nivel ?? "—";
}

function FiltroBusqueda({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border-input bg-background py-2 pl-9 text-sm shadow-sm"
      />
    </div>
  );
}

type OpcionBuscar = { value: string; label: string; sublabel?: string };

function ComboboxBusqueda({
  value,
  onChange,
  options,
  placeholder,
  busquedaPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: OpcionBuscar[];
  placeholder: string;
  busquedaPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const seleccion = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn("truncate", !seleccion && "text-muted-foreground")}>
            {seleccion ? seleccion.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl border-border/60 p-0">
        <Command>
          <CommandInput placeholder={busquedaPlaceholder} className="h-10" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.sublabel ? `${o.label} ${o.sublabel}` : o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-col">
                    <span>{o.label}</span>
                    {o.sublabel && (
                      <span className="text-xs text-muted-foreground">{o.sublabel}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AdminAcademico() {
  const [tab, setTab] = useHashTab(TABS_ACADEMICO, "grados");
  const [cargando, setCargando] = useState(false);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [docentes, setDocentes] = useState<Usuario[]>([]);
  const [estudiantes, setEstudiantes] = useState<Usuario[]>([]);
  const [acudientes, setAcudientes] = useState<Usuario[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [busquedaAsignatura, setBusquedaAsignatura] = useState("");
  const [busquedaCurso, setBusquedaCurso] = useState("");
  const [busquedaAsignacion, setBusquedaAsignacion] = useState("");
  const [busquedaMatricula, setBusquedaMatricula] = useState("");

  // formularios
  const [gradoForm, setGradoForm] = useState({ nombre: "", nivel: "secundaria", orden: "6" });
  const [asignaturaForm, setAsignaturaForm] = useState({ nombre: "", codigo: "", grado_id: "" });
  const [cursoForm, setCursoForm] = useState({
    grado_id: "",
    nombre: "",
    director_id: "",
    ano_lectivo: String(ANO_ACTUAL),
  });
  const [asignacionForm, setAsignacionForm] = useState({
    curso_id: "",
    asignatura_id: "",
    docente_id: "",
    periodo: PERIODO_ACTUAL,
    horario: "",
  });
  const [matriculaForm, setMatriculaForm] = useState({ estudiante_id: "", curso_id: "" });
  const [vincularForm, setVincularForm] = useState({ acudiente_id: "", estudiante_id: "" });

  // edición: un Dialog por sección, con estados separados de los formularios de crear
  const [editandoGrado, setEditandoGrado] = useState<Grado | null>(null);
  const [gradoEdit, setGradoEdit] = useState({ nombre: "", nivel: "secundaria", orden: "6" });
  const [editandoAsignatura, setEditandoAsignatura] = useState<Asignatura | null>(null);
  const [asignaturaEdit, setAsignaturaEdit] = useState({ nombre: "", codigo: "", grado_id: "" });
  const [editandoCurso, setEditandoCurso] = useState<Curso | null>(null);
  const [cursoEdit, setCursoEdit] = useState({ nombre: "", director_id: "", ano_lectivo: "" });
  const [editandoAsignacion, setEditandoAsignacion] = useState<Asignacion | null>(null);
  const [asignacionEdit, setAsignacionEdit] = useState({
    docente_id: "",
    periodo: "",
    horario: "",
  });
  const [editandoMatricula, setEditandoMatricula] = useState<Matricula | null>(null);
  const [matriculaEdit, setMatriculaEdit] = useState({ curso_id: "", fecha_matricula: "" });
  const [editandoVinculo, setEditandoVinculo] = useState<Vinculo | null>(null);
  const [vinculoEdit, setVinculoEdit] = useState({ acudiente_id: "", estudiante_id: "" });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  // Evita doble envío en creaciones/eliminaciones (los PUT usan guardandoEdicion).
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    setCargando(true);
    try {
      const [g, a, c, as, ma, d, e, ac, vi] = await Promise.all([
        api<Grado[]>("/api/admin/grados"),
        api<Asignatura[]>("/api/admin/asignaturas"),
        api<Curso[]>("/api/admin/cursos"),
        api<Asignacion[]>("/api/admin/asignaciones"),
        api<Matricula[]>("/api/admin/matriculas"),
        api<Usuario[]>("/api/admin/usuarios?rol=profesor"),
        api<Usuario[]>("/api/admin/usuarios?rol=estudiante"),
        api<Usuario[]>("/api/admin/usuarios?rol=acudiente"),
        api<Vinculo[]>("/api/admin/vincular-acudiente"),
      ]);
      setGrados(g);
      setAsignaturas(a);
      setCursos(c);
      setAsignaciones(as);
      setMatriculas(ma);
      setDocentes(d);
      setEstudiantes(e);
      setAcudientes(ac);
      setVinculos(vi);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar datos académicos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const qAsignatura = busquedaAsignatura.trim().toLowerCase();
  const asignaturasFiltradas = qAsignatura
    ? asignaturas.filter((a) => a.nombre.toLowerCase().includes(qAsignatura))
    : asignaturas;

  const qCurso = busquedaCurso.trim().toLowerCase();
  const cursosFiltrados = qCurso
    ? cursos.filter((c) =>
        [`${c.grado_nombre} ${c.nombre}`, c.director ?? "", String(c.ano_lectivo)].some((s) =>
          s.toLowerCase().includes(qCurso),
        ),
      )
    : cursos;

  const qAsignacion = busquedaAsignacion.trim().toLowerCase();
  const asignacionesFiltradas = qAsignacion
    ? asignaciones.filter((a) =>
        [a.curso, a.asignatura, a.docente ?? "", a.periodo].some((s) =>
          s.toLowerCase().includes(qAsignacion),
        ),
      )
    : asignaciones;

  const qMatricula = busquedaMatricula.trim().toLowerCase();
  const matriculasFiltradas = qMatricula
    ? matriculas.filter((m) =>
        [m.estudiante, m.correo, m.curso].some((s) => s.toLowerCase().includes(qMatricula)),
      )
    : matriculas;

  async function post(path: string, body: unknown, okMsg: string) {
    if (enviando) return;
    setEnviando(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviando(false);
    }
  }

  async function del(path: string, okMsg: string) {
    if (enviando) return;
    if (!confirm("¿Eliminar? Esta acción no se puede deshacer.")) return;
    setEnviando(true);
    try {
      await api(path, { method: "DELETE" });
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setEnviando(false);
    }
  }

  // PUT de edición: devuelve true si guardó para cerrar el Dialog desde el form.
  async function put(path: string, body: unknown, okMsg: string): Promise<boolean> {
    setGuardandoEdicion(true);
    try {
      await api(path, { method: "PUT", body: JSON.stringify(body) });
      toast.success(okMsg);
      load();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      return false;
    } finally {
      setGuardandoEdicion(false);
    }
  }

  function abrirEditarGrado(g: Grado) {
    setEditandoGrado(g);
    setGradoEdit({ nombre: g.nombre, nivel: g.nivel, orden: String(g.orden) });
  }

  function abrirEditarAsignatura(a: Asignatura) {
    setEditandoAsignatura(a);
    setAsignaturaEdit({
      nombre: a.nombre,
      codigo: a.codigo ?? "",
      grado_id: a.grado_id ? String(a.grado_id) : "",
    });
  }

  function abrirEditarCurso(c: Curso) {
    setEditandoCurso(c);
    setCursoEdit({
      nombre: c.nombre,
      director_id: c.director_id ? String(c.director_id) : "",
      ano_lectivo: String(c.ano_lectivo),
    });
  }

  function abrirEditarAsignacion(a: Asignacion) {
    setEditandoAsignacion(a);
    setAsignacionEdit({
      docente_id: String(a.docente_id),
      periodo: a.periodo,
      horario: a.horario ?? "",
    });
  }

  function abrirEditarMatricula(m: Matricula) {
    setEditandoMatricula(m);
    setMatriculaEdit({
      curso_id: String(m.curso_id),
      fecha_matricula: String(m.fecha_matricula ?? "").slice(0, 10),
    });
  }

  function abrirEditarVinculo(v: Vinculo) {
    setEditandoVinculo(v);
    setVinculoEdit({
      acudiente_id: String(v.acudiente_id),
      estudiante_id: String(v.estudiante_id),
    });
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight">Módulo académico</h2>
        <p className="text-sm text-muted-foreground">
          Grados, asignaturas, cursos, asignaciones, matrículas y vinculación de acudientes
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS_ACADEMICO)[number])}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
          <TabsTrigger value="grados" className="gap-1.5 px-4 py-2 rounded-lg">
            <School className="h-4 w-4" />
            Grados
          </TabsTrigger>
          <TabsTrigger value="asignaturas" className="gap-1.5 px-4 py-2 rounded-lg">
            <BookOpen className="h-4 w-4" />
            Asignaturas
          </TabsTrigger>
          <TabsTrigger value="cursos" className="gap-1.5 px-4 py-2 rounded-lg">
            <Layers className="h-4 w-4" />
            Cursos
          </TabsTrigger>
          <TabsTrigger value="asignaciones" className="gap-1.5 px-4 py-2 rounded-lg">
            <ClipboardCheck className="h-4 w-4" />
            Asignaciones
          </TabsTrigger>
          <TabsTrigger value="matriculas" className="gap-1.5 px-4 py-2 rounded-lg">
            <ClipboardList className="h-4 w-4" />
            Matrículas
          </TabsTrigger>
          <TabsTrigger value="acudientes" className="gap-1.5 px-4 py-2 rounded-lg">
            <HeartHandshake className="h-4 w-4" />
            Vincular acudiente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grados">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nuevo grado</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/grados",
                    {
                      nombre: gradoForm.nombre,
                      nivel: gradoForm.nivel,
                      orden: Number(gradoForm.orden) || 0,
                    },
                    "Grado creado",
                  );
                  setGradoForm({ nombre: "", nivel: "secundaria", orden: "6" });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-4"
              >
                <Input
                  required
                  placeholder="Nombre (ej: Sexto)"
                  value={gradoForm.nombre}
                  onChange={(e) => setGradoForm({ ...gradoForm, nombre: e.target.value })}
                />
                <select
                  required
                  value={gradoForm.nivel}
                  onChange={(e) => setGradoForm({ ...gradoForm, nivel: e.target.value })}
                  className="input-field"
                >
                  {NIVELES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Orden (ej: 6)"
                  value={gradoForm.orden}
                  onChange={(e) => setGradoForm({ ...gradoForm, orden: e.target.value })}
                />
                <Button type="submit" disabled={enviando} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            loading={cargando}
            headers={["ID", "Nombre", "Nivel", "Orden", ""]}
            rows={grados.map((g) => [
              g.id,
              <span key="n" className="font-medium">
                {g.nombre}
              </span>,
              <Badge key="nv" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {nombreNivel(g.nivel)}
              </Badge>,
              g.orden,
              <div key="a" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarGrado(g)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/grados/${g.id}`, "Grado eliminado")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay grados."
          />
          <Dialog
            open={editandoGrado !== null}
            onOpenChange={(open) => !open && setEditandoGrado(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar grado</DialogTitle>
                <DialogDescription>
                  Modifica los datos de "{editandoGrado?.nombre}" y guarda los cambios.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoGrado) return;
                  if (
                    await put(
                      `/api/admin/grados/${editandoGrado.id}`,
                      {
                        nombre: gradoEdit.nombre,
                        nivel: gradoEdit.nivel,
                        orden: Number(gradoEdit.orden) || 0,
                      },
                      "Grado actualizado",
                    )
                  ) {
                    setEditandoGrado(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-grado-nombre">Nombre</Label>
                  <Input
                    id="editar-grado-nombre"
                    required
                    value={gradoEdit.nombre}
                    onChange={(e) => setGradoEdit({ ...gradoEdit, nombre: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-grado-nivel">Nivel</Label>
                    <select
                      id="editar-grado-nivel"
                      value={gradoEdit.nivel}
                      onChange={(e) => setGradoEdit({ ...gradoEdit, nivel: e.target.value })}
                      className="input-field"
                    >
                      {NIVELES.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-grado-orden">Orden</Label>
                    <Input
                      id="editar-grado-orden"
                      type="number"
                      min={0}
                      value={gradoEdit.orden}
                      onChange={(e) => setGradoEdit({ ...gradoEdit, orden: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button type="button" variant="outline" onClick={() => setEditandoGrado(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardandoEdicion} className="gap-1">
                    {guardandoEdicion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="asignaturas">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva asignatura</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/asignaturas",
                    {
                      nombre: asignaturaForm.nombre,
                      codigo: asignaturaForm.codigo || null,
                      grado_id: asignaturaForm.grado_id ? Number(asignaturaForm.grado_id) : null,
                    },
                    "Asignatura creada",
                  );
                  setAsignaturaForm({ nombre: "", codigo: "", grado_id: "" });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-4"
              >
                <Input
                  required
                  placeholder="Nombre (ej: Matemáticas)"
                  value={asignaturaForm.nombre}
                  onChange={(e) => setAsignaturaForm({ ...asignaturaForm, nombre: e.target.value })}
                />
                <Input
                  placeholder="Código (ej: MAT-6)"
                  value={asignaturaForm.codigo}
                  onChange={(e) => setAsignaturaForm({ ...asignaturaForm, codigo: e.target.value })}
                />
                <select
                  value={asignaturaForm.grado_id}
                  onChange={(e) =>
                    setAsignaturaForm({ ...asignaturaForm, grado_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Grado —</option>
                  {grados.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre} ({nombreNivel(g.nivel)})
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={enviando} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaAsignatura}
              onChange={setBusquedaAsignatura}
              placeholder="Buscar asignatura por nombre..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Nombre", "Código", "Grado", ""]}
            rows={asignaturasFiltradas.map((a) => [
              a.id,
              <span key="n" className="font-medium">
                {a.nombre}
              </span>,
              a.codigo ? (
                <Badge
                  key="c"
                  variant="outline"
                  className="rounded-full px-2.5 text-xs font-medium"
                >
                  {a.codigo}
                </Badge>
              ) : (
                "—"
              ),
              a.grado_nombre ? `${a.grado_nombre} (${nombreNivel(a.grado_nivel)})` : "—",
              <div key="a" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarAsignatura(a)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/asignaturas/${a.id}`, "Asignatura eliminada")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay asignaturas."
          />
          <Dialog
            open={editandoAsignatura !== null}
            onOpenChange={(open) => !open && setEditandoAsignatura(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar asignatura</DialogTitle>
                <DialogDescription>
                  Modifica los datos de "{editandoAsignatura?.nombre}" y guarda los cambios.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoAsignatura) return;
                  if (
                    await put(
                      `/api/admin/asignaturas/${editandoAsignatura.id}`,
                      {
                        nombre: asignaturaEdit.nombre,
                        codigo: asignaturaEdit.codigo || null,
                        grado_id: asignaturaEdit.grado_id ? Number(asignaturaEdit.grado_id) : null,
                      },
                      "Asignatura actualizada",
                    )
                  ) {
                    setEditandoAsignatura(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-asignatura-nombre">Nombre</Label>
                  <Input
                    id="editar-asignatura-nombre"
                    required
                    value={asignaturaEdit.nombre}
                    onChange={(e) =>
                      setAsignaturaEdit({ ...asignaturaEdit, nombre: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-asignatura-codigo">Código</Label>
                  <Input
                    id="editar-asignatura-codigo"
                    placeholder="MAT-6"
                    value={asignaturaEdit.codigo}
                    onChange={(e) =>
                      setAsignaturaEdit({ ...asignaturaEdit, codigo: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-asignatura-grado">Grado</Label>
                  <select
                    id="editar-asignatura-grado"
                    value={asignaturaEdit.grado_id}
                    onChange={(e) =>
                      setAsignaturaEdit({ ...asignaturaEdit, grado_id: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="">— Sin grado —</option>
                    {grados.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre} ({nombreNivel(g.nivel)})
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditandoAsignatura(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardandoEdicion} className="gap-1">
                    {guardandoEdicion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="cursos">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nuevo curso</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/cursos",
                    {
                      grado_id: Number(cursoForm.grado_id),
                      nombre: cursoForm.nombre,
                      director_id: cursoForm.director_id ? Number(cursoForm.director_id) : null,
                      ano_lectivo: Number(cursoForm.ano_lectivo),
                    },
                    "Curso creado",
                  );
                  setCursoForm({
                    grado_id: "",
                    nombre: "",
                    director_id: "",
                    ano_lectivo: String(ANO_ACTUAL),
                  });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-5"
              >
                <select
                  required
                  value={cursoForm.grado_id}
                  onChange={(e) => setCursoForm({ ...cursoForm, grado_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Grado —</option>
                  {grados.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre} ({nombreNivel(g.nivel)})
                    </option>
                  ))}
                </select>
                <Input
                  required
                  placeholder="Curso / Letra (ej: A)"
                  value={cursoForm.nombre}
                  onChange={(e) => setCursoForm({ ...cursoForm, nombre: e.target.value })}
                />
                <select
                  value={cursoForm.director_id}
                  onChange={(e) => setCursoForm({ ...cursoForm, director_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Director de grupo —</option>
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre_completo}
                    </option>
                  ))}
                </select>
                <Input
                  required
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="Año lectivo"
                  value={cursoForm.ano_lectivo}
                  onChange={(e) => setCursoForm({ ...cursoForm, ano_lectivo: e.target.value })}
                />
                <Button type="submit" disabled={enviando} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Crear curso
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaCurso}
              onChange={setBusquedaCurso}
              placeholder="Buscar curso por grado, director o año..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Curso", "Grado", "Año", "Director", "Alumnos", ""]}
            rows={cursosFiltrados.map((c) => [
              c.id,
              <Badge
                key="cu"
                variant="outline"
                className="rounded-full bg-primary/5 px-2.5 text-xs font-semibold text-primary"
              >
                {c.grado_nombre} {c.nombre}
              </Badge>,
              <span key="g" className="font-medium">
                {c.grado_nombre}{" "}
                <span className="text-xs text-muted-foreground">
                  ({nombreNivel(c.grado_nivel)})
                </span>
              </span>,
              <Badge key="a" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {c.ano_lectivo}
              </Badge>,
              c.director ?? "—",
              c.alumnos,
              <div key="ac" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarCurso(c)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/cursos/${c.id}`, "Curso eliminado")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay cursos."
          />
          <Dialog
            open={editandoCurso !== null}
            onOpenChange={(open) => !open && setEditandoCurso(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar curso</DialogTitle>
                <DialogDescription>
                  Curso {editandoCurso?.grado_nombre} {editandoCurso?.nombre}. El grado no se puede
                  cambiar para no alterar el histórico de los matriculados.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoCurso) return;
                  if (
                    await put(
                      `/api/admin/cursos/${editandoCurso.id}`,
                      {
                        nombre: cursoEdit.nombre,
                        director_id: cursoEdit.director_id ? Number(cursoEdit.director_id) : null,
                        ano_lectivo: Number(cursoEdit.ano_lectivo),
                      },
                      "Curso actualizado",
                    )
                  ) {
                    setEditandoCurso(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-curso-nombre">Curso / Letra</Label>
                    <Input
                      id="editar-curso-nombre"
                      required
                      placeholder="Ej: A"
                      value={cursoEdit.nombre}
                      onChange={(e) => setCursoEdit({ ...cursoEdit, nombre: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-curso-ano">Año lectivo</Label>
                    <Input
                      id="editar-curso-ano"
                      required
                      type="number"
                      min={2000}
                      max={2100}
                      value={cursoEdit.ano_lectivo}
                      onChange={(e) => setCursoEdit({ ...cursoEdit, ano_lectivo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-curso-director">Director de grupo</Label>
                  <select
                    id="editar-curso-director"
                    value={cursoEdit.director_id}
                    onChange={(e) => setCursoEdit({ ...cursoEdit, director_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— Sin director —</option>
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre_completo}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button type="button" variant="outline" onClick={() => setEditandoCurso(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardandoEdicion} className="gap-1">
                    {guardandoEdicion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="asignaciones">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva asignación</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/asignaciones",
                    {
                      curso_id: Number(asignacionForm.curso_id),
                      asignatura_id: Number(asignacionForm.asignatura_id),
                      docente_id: Number(asignacionForm.docente_id),
                      periodo: asignacionForm.periodo,
                      horario: asignacionForm.horario || null,
                    },
                    "Asignación creada",
                  );
                  setAsignacionForm({
                    curso_id: "",
                    asignatura_id: "",
                    docente_id: "",
                    periodo: PERIODO_ACTUAL,
                    horario: "",
                  });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <select
                  required
                  value={asignacionForm.curso_id}
                  onChange={(e) =>
                    setAsignacionForm({ ...asignacionForm, curso_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Curso —</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grado_nombre} {c.nombre} · {c.ano_lectivo}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={asignacionForm.asignatura_id}
                  onChange={(e) =>
                    setAsignacionForm({ ...asignacionForm, asignatura_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Asignatura —</option>
                  {asignaturas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                      {a.grado_nombre ? ` (${a.grado_nombre})` : ""}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={asignacionForm.docente_id}
                  onChange={(e) =>
                    setAsignacionForm({ ...asignacionForm, docente_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Docente —</option>
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre_completo}
                    </option>
                  ))}
                </select>
                <Input
                  required
                  placeholder="Periodo (ej: 2026-P1)"
                  value={asignacionForm.periodo}
                  onChange={(e) =>
                    setAsignacionForm({ ...asignacionForm, periodo: e.target.value })
                  }
                />
                <Input
                  placeholder="Horario (ej: Lun-Mié 7:00-9:00)"
                  value={asignacionForm.horario}
                  onChange={(e) =>
                    setAsignacionForm({ ...asignacionForm, horario: e.target.value })
                  }
                />
                <Button type="submit" disabled={enviando} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Asignar
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaAsignacion}
              onChange={setBusquedaAsignacion}
              placeholder="Buscar asignación por curso, asignatura o docente..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Curso", "Asignatura", "Periodo", "Horario", "Docente", "Alumnos", ""]}
            rows={asignacionesFiltradas.map((a) => [
              a.id,
              <Badge
                key="cu"
                variant="outline"
                className="rounded-full bg-primary/5 px-2.5 text-xs font-semibold text-primary"
              >
                {a.curso}
              </Badge>,
              <span key="n" className="font-medium">
                {a.asignatura}
                {a.asignatura_codigo && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({a.asignatura_codigo})
                  </span>
                )}
              </span>,
              <Badge key="p" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {a.periodo}
              </Badge>,
              a.horario ?? "—",
              a.docente ?? "—",
              a.alumnos,
              <div key="ac" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarAsignacion(a)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/asignaciones/${a.id}`, "Asignación eliminada")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay asignaciones."
          />
          <Dialog
            open={editandoAsignacion !== null}
            onOpenChange={(open) => !open && setEditandoAsignacion(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar asignación</DialogTitle>
                <DialogDescription>
                  {editandoAsignacion?.asignatura} en {editandoAsignacion?.curso}. El curso y la
                  asignatura no se pueden cambiar para no alterar el histórico.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoAsignacion) return;
                  if (
                    await put(
                      `/api/admin/asignaciones/${editandoAsignacion.id}`,
                      {
                        docente_id: Number(asignacionEdit.docente_id),
                        periodo: asignacionEdit.periodo,
                        horario: asignacionEdit.horario || null,
                      },
                      "Asignación actualizada",
                    )
                  ) {
                    setEditandoAsignacion(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-asignacion-docente">Docente</Label>
                  <select
                    id="editar-asignacion-docente"
                    required
                    value={asignacionEdit.docente_id}
                    onChange={(e) =>
                      setAsignacionEdit({ ...asignacionEdit, docente_id: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="">— Docente —</option>
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre_completo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-asignacion-periodo">Periodo</Label>
                    <Input
                      id="editar-asignacion-periodo"
                      required
                      placeholder="Ej: 2026-P1"
                      value={asignacionEdit.periodo}
                      onChange={(e) =>
                        setAsignacionEdit({ ...asignacionEdit, periodo: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-asignacion-horario">Horario</Label>
                    <Input
                      id="editar-asignacion-horario"
                      placeholder="Ej: Lun-Mié 7:00-9:00"
                      value={asignacionEdit.horario}
                      onChange={(e) =>
                        setAsignacionEdit({ ...asignacionEdit, horario: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditandoAsignacion(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardandoEdicion} className="gap-1">
                    {guardandoEdicion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="matriculas">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva matrícula</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/matriculas",
                    {
                      estudiante_id: Number(matriculaForm.estudiante_id),
                      curso_id: Number(matriculaForm.curso_id),
                    },
                    "Estudiante matriculado",
                  );
                  setMatriculaForm({ estudiante_id: "", curso_id: "" });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <div className="relative">
                  <ComboboxBusqueda
                    value={matriculaForm.estudiante_id}
                    onChange={(v) => setMatriculaForm({ ...matriculaForm, estudiante_id: v })}
                    options={estudiantes.map((u) => ({
                      value: String(u.id),
                      label: u.nombre_completo,
                      sublabel: u.correo,
                    }))}
                    placeholder="— Estudiante —"
                    busquedaPlaceholder="Buscar por nombre o correo..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={matriculaForm.estudiante_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <div className="relative">
                  <ComboboxBusqueda
                    value={matriculaForm.curso_id}
                    onChange={(v) => setMatriculaForm({ ...matriculaForm, curso_id: v })}
                    options={cursos.map((c) => ({
                      value: String(c.id),
                      label: `${c.grado_nombre} ${c.nombre}`,
                      sublabel: `${c.ano_lectivo}${c.director ? ` · Dir. ${c.director}` : ""}`,
                    }))}
                    placeholder="— Curso —"
                    busquedaPlaceholder="Buscar por grado o año..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={matriculaForm.curso_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <Button type="submit" disabled={enviando} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Matricular
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Al matricular, el estudiante queda inscrito automáticamente en las asignaturas
                asignadas a ese curso.
              </p>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaMatricula}
              onChange={setBusquedaMatricula}
              placeholder="Buscar matrícula por estudiante, correo o curso..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Estudiante", "Curso", "Año", "Asignaturas", ""]}
            rows={matriculasFiltradas.map((m) => [
              m.id,
              <div key="e">
                <div className="font-medium">{m.estudiante}</div>
                <div className="text-xs text-muted-foreground">{m.correo}</div>
              </div>,
              <Badge
                key="cu"
                variant="outline"
                className="rounded-full bg-primary/5 px-2.5 text-xs font-semibold text-primary"
              >
                {m.curso}
              </Badge>,
              <Badge key="a" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {m.ano_lectivo}
              </Badge>,
              m.asignaturas,
              <div key="ac" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarMatricula(m)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/matriculas/${m.id}`, "Matrícula eliminada")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Retirar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay matrículas."
          />
          <Dialog
            open={editandoMatricula !== null}
            onOpenChange={(open) => !open && setEditandoMatricula(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar matrícula</DialogTitle>
                <DialogDescription>
                  Matrícula de {editandoMatricula?.estudiante} ({editandoMatricula?.correo}). El
                  estudiante no se puede cambiar; si ya tiene notas o asistencia, el cambio de curso
                  se bloquea para no borrar su historia.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoMatricula) return;
                  if (
                    await put(
                      `/api/admin/matriculas/${editandoMatricula.id}`,
                      {
                        curso_id: Number(matriculaEdit.curso_id),
                        fecha_matricula: matriculaEdit.fecha_matricula || null,
                      },
                      "Matrícula actualizada",
                    )
                  ) {
                    setEditandoMatricula(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="relative grid gap-1.5">
                  <Label>Curso</Label>
                  <ComboboxBusqueda
                    value={matriculaEdit.curso_id}
                    onChange={(v) => setMatriculaEdit({ ...matriculaEdit, curso_id: v })}
                    options={cursos.map((c) => ({
                      value: String(c.id),
                      label: `${c.grado_nombre} ${c.nombre}`,
                      sublabel: `${c.ano_lectivo}${c.director ? ` · Dir. ${c.director}` : ""}`,
                    }))}
                    placeholder="— Curso —"
                    busquedaPlaceholder="Buscar por grado o año..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={matriculaEdit.curso_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-matricula-fecha">Fecha de matrícula</Label>
                  <Input
                    id="editar-matricula-fecha"
                    type="date"
                    value={matriculaEdit.fecha_matricula}
                    onChange={(e) =>
                      setMatriculaEdit({ ...matriculaEdit, fecha_matricula: e.target.value })
                    }
                  />
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditandoMatricula(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardandoEdicion} className="gap-1">
                    {guardandoEdicion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="acudientes">
          <Card className="border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-5 w-5 text-sky-600" />
                Vincular acudiente con estudiante
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/vincular-acudiente",
                    {
                      acudiente_id: Number(vincularForm.acudiente_id),
                      estudiante_id: Number(vincularForm.estudiante_id),
                    },
                    "Acudiente vinculado",
                  );
                  setVincularForm({ acudiente_id: "", estudiante_id: "" });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <div className="relative">
                  <ComboboxBusqueda
                    value={vincularForm.acudiente_id}
                    onChange={(v) => setVincularForm({ ...vincularForm, acudiente_id: v })}
                    options={acudientes.map((a) => ({
                      value: String(a.id),
                      label: a.nombre_completo,
                      sublabel: a.correo,
                    }))}
                    placeholder="— Acudiente —"
                    busquedaPlaceholder="Buscar por nombre o correo..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={vincularForm.acudiente_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <div className="relative">
                  <ComboboxBusqueda
                    value={vincularForm.estudiante_id}
                    onChange={(v) => setVincularForm({ ...vincularForm, estudiante_id: v })}
                    options={estudiantes.map((u) => ({
                      value: String(u.id),
                      label: u.nombre_completo,
                      sublabel: u.correo,
                    }))}
                    placeholder="— Estudiante —"
                    busquedaPlaceholder="Buscar por nombre o correo..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={vincularForm.estudiante_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={enviando}
                  className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <Link2 className="h-4 w-4" />
                  Vincular
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Al vincular, el acudiente podrá consultar las notas, asistencia y boletín de ese
                estudiante.
              </p>
            </CardContent>
          </Card>
          <div className="mb-3 mt-6">
            <h3 className="font-semibold tracking-tight">Vinculaciones actuales</h3>
            <p className="text-sm text-muted-foreground">
              Revisa qué acudientes están asociados a cada estudiante y desvincula si es necesario.
            </p>
          </div>
          <DataTable
            loading={cargando}
            headers={[
              "Acudiente",
              "Correo del acudiente",
              "Estudiante",
              "Correo del estudiante",
              "",
            ]}
            rows={vinculos.map((v) => [
              <div key="ac">
                <div className="font-medium">{v.acudiente}</div>
                <div className="text-xs text-muted-foreground">#{v.acudiente_id}</div>
              </div>,
              v.acudiente_correo,
              <div key="es">
                <div className="font-medium">{v.estudiante}</div>
                <div className="text-xs text-muted-foreground">#{v.estudiante_id}</div>
              </div>,
              v.estudiante_correo,
              <div key="a" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarVinculo(v)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    del(`/api/admin/vincular-acudiente/${v.id}`, "Vinculación eliminada")
                  }
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Desvincular
                </Button>
              </div>,
            ])}
            emptyMessage="No hay acudientes vinculados aún."
          />
          <Dialog
            open={editandoVinculo !== null}
            onOpenChange={(open) => !open && setEditandoVinculo(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar vinculación</DialogTitle>
                <DialogDescription>
                  Cambia el acudiente o el estudiante de esta vinculación.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoVinculo) return;
                  if (
                    await put(
                      `/api/admin/vincular-acudiente/${editandoVinculo.id}`,
                      {
                        acudiente_id: Number(vinculoEdit.acudiente_id),
                        estudiante_id: Number(vinculoEdit.estudiante_id),
                      },
                      "Vinculación actualizada",
                    )
                  ) {
                    setEditandoVinculo(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="relative grid gap-1.5">
                  <Label>Acudiente</Label>
                  <ComboboxBusqueda
                    value={vinculoEdit.acudiente_id}
                    onChange={(v) => setVinculoEdit({ ...vinculoEdit, acudiente_id: v })}
                    options={acudientes.map((a) => ({
                      value: String(a.id),
                      label: a.nombre_completo,
                      sublabel: a.correo,
                    }))}
                    placeholder="— Acudiente —"
                    busquedaPlaceholder="Buscar por nombre o correo..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={vinculoEdit.acudiente_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <div className="relative grid gap-1.5">
                  <Label>Estudiante</Label>
                  <ComboboxBusqueda
                    value={vinculoEdit.estudiante_id}
                    onChange={(v) => setVinculoEdit({ ...vinculoEdit, estudiante_id: v })}
                    options={estudiantes.map((u) => ({
                      value: String(u.id),
                      label: u.nombre_completo,
                      sublabel: u.correo,
                    }))}
                    placeholder="— Estudiante —"
                    busquedaPlaceholder="Buscar por nombre o correo..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={vinculoEdit.estudiante_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button type="button" variant="outline" onClick={() => setEditandoVinculo(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={guardandoEdicion} className="gap-1">
                    {guardandoEdicion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </>
  );
}
