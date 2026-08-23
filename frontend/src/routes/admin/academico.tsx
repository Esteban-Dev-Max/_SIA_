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

type Carrera = { id: number; nombre: string; codigo: string };
type Materia = {
  id: number;
  nombre: string;
  codigo: string;
  creditos: number;
  carrera_id: number | null;
  carrera_nombre: string | null;
};
type Grupo = {
  id: number;
  materia_id: number;
  codigo_grupo: string;
  periodo: string;
  horario: string | null;
  materia: string;
  materia_codigo: string;
  profesor_id: number;
  profesor: string | null;
  alumnos: number;
};
type Matricula = {
  id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  grupo_id: number;
  codigo_grupo: string;
  materia: string;
  periodo: string;
  fecha_matricula: string;
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

const TABS_ACADEMICO = ["carreras", "materias", "grupos", "matriculas", "acudientes"] as const;

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
  const [tab, setTab] = useHashTab(TABS_ACADEMICO, "carreras");
  const [cargando, setCargando] = useState(false);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [estudiantes, setEstudiantes] = useState<Usuario[]>([]);
  const [acudientes, setAcudientes] = useState<Usuario[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [busquedaMateria, setBusquedaMateria] = useState("");
  const [busquedaGrupo, setBusquedaGrupo] = useState("");
  const [busquedaMatricula, setBusquedaMatricula] = useState("");

  // formularios
  const [carreraForm, setCarreraForm] = useState({ nombre: "", codigo: "" });
  const [materiaForm, setMateriaForm] = useState({
    nombre: "",
    codigo: "",
    creditos: "3",
    carrera_id: "",
  });
  const [grupoForm, setGrupoForm] = useState({
    materia_id: "",
    codigo_grupo: "",
    profesor_id: "",
    periodo: "2026-1",
    horario: "",
  });
  const [matriculaForm, setMatriculaForm] = useState({
    estudiante_id: "",
    grupo_id: "",
  });
  const [vincularForm, setVincularForm] = useState({ acudiente_id: "", estudiante_id: "" });

  // edición: un Dialog por sección, con estados separados de los formularios de crear
  const [editandoCarrera, setEditandoCarrera] = useState<Carrera | null>(null);
  const [carreraEdit, setCarreraEdit] = useState({ nombre: "", codigo: "" });
  const [editandoMateria, setEditandoMateria] = useState<Materia | null>(null);
  const [materiaEdit, setMateriaEdit] = useState({
    nombre: "",
    codigo: "",
    creditos: "3",
    carrera_id: "",
  });
  const [editandoGrupo, setEditandoGrupo] = useState<Grupo | null>(null);
  const [grupoEdit, setGrupoEdit] = useState({
    codigo_grupo: "",
    profesor_id: "",
    periodo: "",
    horario: "",
  });
  const [editandoMatricula, setEditandoMatricula] = useState<Matricula | null>(null);
  const [matriculaEdit, setMatriculaEdit] = useState({ grupo_id: "", fecha_matricula: "" });
  const [editandoVinculo, setEditandoVinculo] = useState<Vinculo | null>(null);
  const [vinculoEdit, setVinculoEdit] = useState({ acudiente_id: "", estudiante_id: "" });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const load = useCallback(async () => {
    setCargando(true);
    try {
      const [c, m, g, ma, p, e, ac, vi] = await Promise.all([
        api<Carrera[]>("/api/admin/carreras"),
        api<Materia[]>("/api/admin/materias"),
        api<Grupo[]>("/api/admin/grupos"),
        api<Matricula[]>("/api/admin/matriculas"),
        api<Usuario[]>("/api/admin/usuarios?rol=profesor"),
        api<Usuario[]>("/api/admin/usuarios?rol=estudiante"),
        api<Usuario[]>("/api/admin/usuarios?rol=acudiente"),
        api<Vinculo[]>("/api/admin/vincular-acudiente"),
      ]);
      setCarreras(c);
      setMaterias(m);
      setGrupos(g);
      setMatriculas(ma);
      setProfesores(p);
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

  const qMateria = busquedaMateria.trim().toLowerCase();
  const materiasFiltradas = qMateria
    ? materias.filter((m) => m.nombre.toLowerCase().includes(qMateria))
    : materias;

  const qGrupo = busquedaGrupo.trim().toLowerCase();
  const gruposFiltrados = qGrupo
    ? grupos.filter((g) =>
        [g.codigo_grupo, g.materia, g.materia_codigo, g.profesor ?? ""].some((s) =>
          s.toLowerCase().includes(qGrupo),
        ),
      )
    : grupos;

  const qMatricula = busquedaMatricula.trim().toLowerCase();
  const matriculasFiltradas = qMatricula
    ? matriculas.filter((m) =>
        [m.estudiante, m.correo, m.codigo_grupo].some((s) => s.toLowerCase().includes(qMatricula)),
      )
    : matriculas;

  async function post(path: string, body: unknown, okMsg: string) {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function del(path: string, okMsg: string) {
    if (!confirm("¿Eliminar? Esta acción no se puede deshacer.")) return;
    try {
      await api(path, { method: "DELETE" });
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
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

  function abrirEditarCarrera(c: Carrera) {
    setEditandoCarrera(c);
    setCarreraEdit({ nombre: c.nombre, codigo: c.codigo });
  }

  function abrirEditarMateria(m: Materia) {
    setEditandoMateria(m);
    setMateriaEdit({
      nombre: m.nombre,
      codigo: m.codigo,
      creditos: String(m.creditos),
      carrera_id: m.carrera_id ? String(m.carrera_id) : "",
    });
  }

  function abrirEditarGrupo(g: Grupo) {
    setEditandoGrupo(g);
    setGrupoEdit({
      codigo_grupo: g.codigo_grupo,
      profesor_id: g.profesor_id ? String(g.profesor_id) : "",
      periodo: g.periodo,
      horario: g.horario ?? "",
    });
  }

  function abrirEditarMatricula(m: Matricula) {
    setEditandoMatricula(m);
    setMatriculaEdit({
      grupo_id: String(m.grupo_id),
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
          Carreras, materias, grupos, matrículas y vinculación de acudientes
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS_ACADEMICO)[number])}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
          <TabsTrigger value="carreras" className="gap-1.5 px-4 py-2 rounded-lg">
            <School className="h-4 w-4" />
            Carreras
          </TabsTrigger>
          <TabsTrigger value="materias" className="gap-1.5 px-4 py-2 rounded-lg">
            <BookOpen className="h-4 w-4" />
            Materias
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1.5 px-4 py-2 rounded-lg">
            <Layers className="h-4 w-4" />
            Grupos
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

        <TabsContent value="carreras">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva carrera / grado</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post("/api/admin/carreras", carreraForm, "Carrera creada");
                  setCarreraForm({ nombre: "", codigo: "" });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <Input
                  required
                  placeholder="Nombre"
                  value={carreraForm.nombre}
                  onChange={(e) => setCarreraForm({ ...carreraForm, nombre: e.target.value })}
                />
                <Input
                  placeholder="Código (opcional)"
                  value={carreraForm.codigo}
                  onChange={(e) => setCarreraForm({ ...carreraForm, codigo: e.target.value })}
                />
                <Button type="submit" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            loading={cargando}
            headers={["ID", "Nombre", "Código", ""]}
            rows={carreras.map((c) => [
              c.id,
              <span key="n" className="font-medium">
                {c.nombre}
              </span>,
              <Badge key="c" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {c.codigo}
              </Badge>,
              <div key="a" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarCarrera(c)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/carreras/${c.id}`, "Carrera eliminada")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay carreras o grados."
          />
          <Dialog
            open={editandoCarrera !== null}
            onOpenChange={(open) => !open && setEditandoCarrera(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar carrera</DialogTitle>
                <DialogDescription>
                  Modifica los datos de "{editandoCarrera?.nombre}" y guarda los cambios.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoCarrera) return;
                  if (
                    await put(
                      `/api/admin/carreras/${editandoCarrera.id}`,
                      { nombre: carreraEdit.nombre, codigo: carreraEdit.codigo },
                      "Carrera actualizada",
                    )
                  ) {
                    setEditandoCarrera(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-carrera-nombre">Nombre</Label>
                  <Input
                    id="editar-carrera-nombre"
                    required
                    value={carreraEdit.nombre}
                    onChange={(e) => setCarreraEdit({ ...carreraEdit, nombre: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-carrera-codigo">Código</Label>
                  <Input
                    id="editar-carrera-codigo"
                    required
                    value={carreraEdit.codigo}
                    onChange={(e) => setCarreraEdit({ ...carreraEdit, codigo: e.target.value })}
                  />
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button type="button" variant="outline" onClick={() => setEditandoCarrera(null)}>
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

        <TabsContent value="materias">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva materia</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/materias",
                    {
                      nombre: materiaForm.nombre,
                      codigo: materiaForm.codigo,
                      creditos: Number(materiaForm.creditos) || 0,
                      carrera_id: materiaForm.carrera_id ? Number(materiaForm.carrera_id) : null,
                    },
                    "Materia creada",
                  );
                  setMateriaForm({
                    ...materiaForm,
                    nombre: "",
                    codigo: "",
                    creditos: "3",
                    carrera_id: "",
                  });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-4"
              >
                <Input
                  required
                  placeholder="Nombre"
                  value={materiaForm.nombre}
                  onChange={(e) => setMateriaForm({ ...materiaForm, nombre: e.target.value })}
                />
                <Input
                  required
                  placeholder="Código (ej: SIS-101)"
                  value={materiaForm.codigo}
                  onChange={(e) => setMateriaForm({ ...materiaForm, codigo: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  max={5}
                  placeholder="Créditos"
                  value={materiaForm.creditos}
                  onChange={(e) => setMateriaForm({ ...materiaForm, creditos: e.target.value })}
                />
                <select
                  value={materiaForm.carrera_id}
                  onChange={(e) => setMateriaForm({ ...materiaForm, carrera_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Carrera —</option>
                  {carreras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="gap-1.5 sm:col-span-4 sm:w-fit">
                  <Plus className="h-4 w-4" />
                  Agregar materia
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaMateria}
              onChange={setBusquedaMateria}
              placeholder="Buscar materia por nombre..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Nombre", "Código", "Créditos", "Carrera", ""]}
            rows={materiasFiltradas.map((m) => [
              m.id,
              <span key="n" className="font-medium">
                {m.nombre}
              </span>,
              <Badge key="c" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {m.codigo}
              </Badge>,
              m.creditos,
              m.carrera_nombre ?? "—",
              <div key="a" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarMateria(m)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/materias/${m.id}`, "Materia eliminada")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay materias."
          />
          <Dialog
            open={editandoMateria !== null}
            onOpenChange={(open) => !open && setEditandoMateria(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar materia</DialogTitle>
                <DialogDescription>
                  Modifica los datos de "{editandoMateria?.nombre}" y guarda los cambios.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoMateria) return;
                  if (
                    await put(
                      `/api/admin/materias/${editandoMateria.id}`,
                      {
                        nombre: materiaEdit.nombre,
                        codigo: materiaEdit.codigo,
                        creditos: Number(materiaEdit.creditos) || 0,
                        carrera_id: materiaEdit.carrera_id ? Number(materiaEdit.carrera_id) : null,
                      },
                      "Materia actualizada",
                    )
                  ) {
                    setEditandoMateria(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-materia-nombre">Nombre</Label>
                  <Input
                    id="editar-materia-nombre"
                    required
                    value={materiaEdit.nombre}
                    onChange={(e) => setMateriaEdit({ ...materiaEdit, nombre: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-materia-codigo">Código</Label>
                    <Input
                      id="editar-materia-codigo"
                      required
                      placeholder="SIS-101"
                      value={materiaEdit.codigo}
                      onChange={(e) => setMateriaEdit({ ...materiaEdit, codigo: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-materia-creditos">Créditos</Label>
                    <Input
                      id="editar-materia-creditos"
                      type="number"
                      min={0}
                      value={materiaEdit.creditos}
                      onChange={(e) => setMateriaEdit({ ...materiaEdit, creditos: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-materia-carrera">Carrera</Label>
                  <select
                    id="editar-materia-carrera"
                    value={materiaEdit.carrera_id}
                    onChange={(e) => setMateriaEdit({ ...materiaEdit, carrera_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— Sin carrera —</option>
                    {carreras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button type="button" variant="outline" onClick={() => setEditandoMateria(null)}>
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

        <TabsContent value="grupos">
          <Card className="mb-4 border-border/50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nuevo grupo</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post(
                    "/api/admin/grupos",
                    {
                      materia_id: Number(grupoForm.materia_id),
                      codigo_grupo: grupoForm.codigo_grupo.trim(),
                      profesor_id: Number(grupoForm.profesor_id),
                      periodo: grupoForm.periodo,
                      horario: grupoForm.horario || null,
                    },
                    "Grupo creado",
                  );
                  setGrupoForm({
                    ...grupoForm,
                    materia_id: "",
                    codigo_grupo: "",
                    profesor_id: "",
                    horario: "",
                  });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-5"
              >
                <Input
                  required
                  placeholder="Código / Ficha del grupo (ej: 1003)"
                  value={grupoForm.codigo_grupo}
                  onChange={(e) => setGrupoForm({ ...grupoForm, codigo_grupo: e.target.value })}
                />
                <select
                  required
                  value={grupoForm.materia_id}
                  onChange={(e) => setGrupoForm({ ...grupoForm, materia_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Materia —</option>
                  {materias.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={grupoForm.profesor_id}
                  onChange={(e) => setGrupoForm({ ...grupoForm, profesor_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Profesor —</option>
                  {profesores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre_completo}
                    </option>
                  ))}
                </select>
                <Input
                  required
                  placeholder="Periodo (ej: 2026-1)"
                  value={grupoForm.periodo}
                  onChange={(e) => setGrupoForm({ ...grupoForm, periodo: e.target.value })}
                />
                <Input
                  placeholder="Horario"
                  value={grupoForm.horario}
                  onChange={(e) => setGrupoForm({ ...grupoForm, horario: e.target.value })}
                />
                <Button type="submit" className="gap-1.5 sm:col-span-5 sm:w-fit">
                  <Plus className="h-4 w-4" />
                  Crear grupo
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaGrupo}
              onChange={setBusquedaGrupo}
              placeholder="Buscar grupo por ficha, materia o profesor..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Grupo", "Materia", "Periodo", "Horario", "Profesor", "Alumnos", ""]}
            rows={gruposFiltrados.map((g) => [
              g.id,
              <Badge
                key="cg"
                variant="outline"
                className="rounded-full bg-primary/5 px-2.5 text-xs font-semibold text-primary"
              >
                Ficha {g.codigo_grupo}
              </Badge>,
              <span key="n" className="font-medium">
                {g.materia}
                <span className="ml-1.5 text-xs text-muted-foreground">({g.materia_codigo})</span>
              </span>,
              <Badge key="p" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {g.periodo}
              </Badge>,
              g.horario ?? "—",
              g.profesor ?? "—",
              g.alumnos,
              <div key="a" className="flex gap-1">
                <Button
                  key="e"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirEditarGrupo(g)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  key="d"
                  variant="ghost"
                  size="sm"
                  onClick={() => del(`/api/admin/grupos/${g.id}`, "Grupo eliminado")}
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>,
            ])}
            emptyMessage="Aún no hay grupos."
          />
          <Dialog
            open={editandoGrupo !== null}
            onOpenChange={(open) => !open && setEditandoGrupo(null)}
          >
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Editar grupo</DialogTitle>
                <DialogDescription>
                  Grupo de {editandoGrupo?.materia} ({editandoGrupo?.materia_codigo}). La materia no
                  se puede cambiar para no alterar el histórico de los matriculados.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editandoGrupo) return;
                  if (
                    await put(
                      `/api/admin/grupos/${editandoGrupo.id}`,
                      {
                        codigo_grupo: grupoEdit.codigo_grupo.trim(),
                        profesor_id: Number(grupoEdit.profesor_id),
                        periodo: grupoEdit.periodo,
                        horario: grupoEdit.horario || null,
                      },
                      "Grupo actualizado",
                    )
                  ) {
                    setEditandoGrupo(null);
                  }
                }}
                className="grid gap-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-grupo-ficha">Código / Ficha</Label>
                    <Input
                      id="editar-grupo-ficha"
                      required
                      placeholder="Ej: 1003"
                      value={grupoEdit.codigo_grupo}
                      onChange={(e) => setGrupoEdit({ ...grupoEdit, codigo_grupo: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="editar-grupo-periodo">Periodo</Label>
                    <Input
                      id="editar-grupo-periodo"
                      required
                      placeholder="Ej: 2026-1"
                      value={grupoEdit.periodo}
                      onChange={(e) => setGrupoEdit({ ...grupoEdit, periodo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-grupo-profesor">Profesor</Label>
                  <select
                    id="editar-grupo-profesor"
                    required
                    value={grupoEdit.profesor_id}
                    onChange={(e) => setGrupoEdit({ ...grupoEdit, profesor_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— Profesor —</option>
                    {profesores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_completo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="editar-grupo-horario">Horario</Label>
                  <Input
                    id="editar-grupo-horario"
                    placeholder="Ej: Lun-Mié 8:00-10:00"
                    value={grupoEdit.horario}
                    onChange={(e) => setGrupoEdit({ ...grupoEdit, horario: e.target.value })}
                  />
                </div>
                <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
                  <Button type="button" variant="outline" onClick={() => setEditandoGrupo(null)}>
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
                      grupo_id: Number(matriculaForm.grupo_id),
                    },
                    "Estudiante matriculado",
                  );
                  setMatriculaForm({ estudiante_id: "", grupo_id: "" });
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
                    value={matriculaForm.grupo_id}
                    onChange={(v) => setMatriculaForm({ ...matriculaForm, grupo_id: v })}
                    options={grupos.map((g) => ({
                      value: String(g.id),
                      label: g.codigo_grupo,
                      sublabel: `${g.materia} · ${g.periodo}`,
                    }))}
                    placeholder="— Grupo —"
                    busquedaPlaceholder="Buscar por ficha o materia..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={matriculaForm.grupo_id}
                    onChange={() => {}}
                    className="absolute h-0 w-0 opacity-0"
                  />
                </div>
                <Button type="submit" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Matricular
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mb-3">
            <FiltroBusqueda
              value={busquedaMatricula}
              onChange={setBusquedaMatricula}
              placeholder="Buscar matrícula por estudiante, correo o grupo..."
            />
          </div>
          <DataTable
            loading={cargando}
            headers={["ID", "Estudiante", "Materia", "Grupo", "Periodo", ""]}
            rows={matriculasFiltradas.map((m) => [
              m.id,
              <div key="e">
                <div className="font-medium">{m.estudiante}</div>
                <div className="text-xs text-muted-foreground">{m.correo}</div>
              </div>,
              m.materia,
              <Badge
                key="cg"
                variant="outline"
                className="rounded-full bg-primary/5 px-2.5 text-xs font-semibold text-primary"
              >
                {m.codigo_grupo}
              </Badge>,
              <Badge key="p" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {m.periodo}
              </Badge>,
              <div key="a" className="flex gap-1">
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
                  Eliminar
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
                  estudiante no se puede cambiar para no transferir sus notas ni asistencia.
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
                        grupo_id: Number(matriculaEdit.grupo_id),
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
                  <Label>Grupo / Sección</Label>
                  <ComboboxBusqueda
                    value={matriculaEdit.grupo_id}
                    onChange={(v) => setMatriculaEdit({ ...matriculaEdit, grupo_id: v })}
                    options={grupos.map((g) => ({
                      value: String(g.id),
                      label: g.codigo_grupo,
                      sublabel: `${g.materia} · ${g.periodo}`,
                    }))}
                    placeholder="— Grupo —"
                    busquedaPlaceholder="Buscar por ficha o materia..."
                  />
                  <input
                    required
                    tabIndex={-1}
                    aria-hidden="true"
                    value={matriculaEdit.grupo_id}
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
                <Button type="submit" className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white">
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
