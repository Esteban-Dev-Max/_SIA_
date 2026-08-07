import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useHashTab } from "@/hooks/use-hash-tab";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  School,
  BookOpen,
  Layers,
  ClipboardList,
  HeartHandshake,
  Plus,
  Trash2,
  Link2,
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
};
type Usuario = { id: number; nombre_completo: string; correo: string; rol: string };

const TABS_ACADEMICO = ["carreras", "materias", "grupos", "matriculas", "acudientes"] as const;

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

  const load = useCallback(async () => {
    setCargando(true);
    try {
      const [c, m, g, ma, p, e, ac] = await Promise.all([
        api<Carrera[]>("/api/admin/carreras"),
        api<Materia[]>("/api/admin/materias"),
        api<Grupo[]>("/api/admin/grupos"),
        api<Matricula[]>("/api/admin/matriculas"),
        api<Usuario[]>("/api/admin/usuarios?rol=profesor"),
        api<Usuario[]>("/api/admin/usuarios?rol=estudiante"),
        api<Usuario[]>("/api/admin/usuarios?rol=acudiente"),
      ]);
      setCarreras(c);
      setMaterias(m);
      setGrupos(g);
      setMatriculas(ma);
      setProfesores(p);
      setEstudiantes(e);
      setAcudientes(ac);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar datos académicos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
              <Button
                key="d"
                variant="ghost"
                size="sm"
                onClick={() => del(`/api/admin/carreras/${c.id}`, "Carrera eliminada")}
                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>,
            ])}
            emptyMessage="Aún no hay carreras o grados."
          />
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
          <DataTable
            loading={cargando}
            headers={["ID", "Nombre", "Código", "Créditos", "Carrera", ""]}
            rows={materias.map((m) => [
              m.id,
              <span key="n" className="font-medium">
                {m.nombre}
              </span>,
              <Badge key="c" variant="outline" className="rounded-full px-2.5 text-xs font-medium">
                {m.codigo}
              </Badge>,
              m.creditos,
              m.carrera_nombre ?? "—",
              <Button
                key="d"
                variant="ghost"
                size="sm"
                onClick={() => del(`/api/admin/materias/${m.id}`, "Materia eliminada")}
                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>,
            ])}
            emptyMessage="Aún no hay materias."
          />
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
          <DataTable
            loading={cargando}
            headers={["ID", "Grupo", "Materia", "Periodo", "Horario", "Profesor", "Alumnos", ""]}
            rows={grupos.map((g) => [
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
              <Button
                key="d"
                variant="ghost"
                size="sm"
                onClick={() => del(`/api/admin/grupos/${g.id}`, "Grupo eliminado")}
                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>,
            ])}
            emptyMessage="Aún no hay grupos."
          />
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
                <select
                  required
                  value={matriculaForm.estudiante_id}
                  onChange={(e) =>
                    setMatriculaForm({ ...matriculaForm, estudiante_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Estudiante —</option>
                  {estudiantes.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={matriculaForm.grupo_id}
                  onChange={(e) => setMatriculaForm({ ...matriculaForm, grupo_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Grupo —</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.codigo_grupo} · {g.materia} · {g.periodo}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Matricular
                </Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            loading={cargando}
            headers={["ID", "Estudiante", "Materia", "Grupo", "Periodo", ""]}
            rows={matriculas.map((m) => [
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
              <Button
                key="d"
                variant="ghost"
                size="sm"
                onClick={() => del(`/api/admin/matriculas/${m.id}`, "Matrícula eliminada")}
                className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>,
            ])}
            emptyMessage="Aún no hay matrículas."
          />
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
                <select
                  required
                  value={vincularForm.acudiente_id}
                  onChange={(e) =>
                    setVincularForm({ ...vincularForm, acudiente_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Acudiente —</option>
                  {acudientes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre_completo}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={vincularForm.estudiante_id}
                  onChange={(e) =>
                    setVincularForm({ ...vincularForm, estudiante_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">— Estudiante —</option>
                  {estudiantes.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo}
                    </option>
                  ))}
                </select>
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
        </TabsContent>
      </Tabs>
    </>
  );
}
