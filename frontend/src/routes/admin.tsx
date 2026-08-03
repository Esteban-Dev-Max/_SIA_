import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Users, BookOpen, GraduationCap, ClipboardList, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireRole("admin"),
  component: AdminPanel,
});

const tabLabels: Record<string, string> = {
  estudiantes: "Estudiantes",
  profesores: "Profesores",
  carreras: "Carreras",
  materias: "Materias",
  matriculas: "Matrículas",
};

const tabIcons: Record<string, React.ReactNode> = {
  estudiantes: <Users className="h-4 w-4" />,
  profesores: <GraduationCap className="h-4 w-4" />,
  carreras: <BookOpen className="h-4 w-4" />,
  materias: <ClipboardList className="h-4 w-4" />,
  matriculas: <LayoutDashboard className="h-4 w-4" />,
};

function AdminPanel() {
  return (
    <PanelShell title="Panel Administrador">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Estudiantes" value="—" icon={Users} accent="primary" />
        <StatCard label="Profesores" value="—" icon={GraduationCap} accent="emerald" />
        <StatCard label="Carreras" value="—" icon={BookOpen} accent="amber" />
        <StatCard label="Matrículas" value="—" icon={ClipboardList} accent="violet" />
      </div>

      <Tabs defaultValue="estudiantes" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
          {Object.entries(tabLabels).map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="gap-1.5 px-4 py-2 rounded-lg data-[state=active]:shadow-sm"
            >
              {tabIcons[key]}
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="estudiantes">
          <Usuarios rol="estudiante" />
        </TabsContent>
        <TabsContent value="profesores">
          <Usuarios rol="profesor" />
        </TabsContent>
        <TabsContent value="carreras">
          <Carreras />
        </TabsContent>
        <TabsContent value="materias">
          <Materias />
        </TabsContent>
        <TabsContent value="matriculas">
          <Matriculas />
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}

type Usuario = { id: number; nombre: string; email: string; rol: string };

function Usuarios({ rol }: { rol: "estudiante" | "profesor" }) {
  const [items, setItems] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setItems(await api<Usuario[]>(`/api/admin/usuarios?rol=${rol}`));
  }
  useEffect(() => {
    load();
  }, [rol]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api("/api/admin/usuarios", {
        method: "POST",
        body: JSON.stringify({ ...form, rol }),
      });
      setForm({ nombre: "", email: "", password: "" });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }
  async function remove(id: number) {
    if (!confirm("¿Eliminar?")) return;
    await api(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Agregar {rol === "estudiante" ? "estudiante" : "profesor"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input
              required
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <Input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              required
              type="password"
              placeholder="Contraseña"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button type="submit" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
            {err && <p className="col-span-full text-sm text-destructive">{err}</p>}
          </form>
        </CardContent>
      </Card>
      <DataTable
        headers={["ID", "Nombre", "Email", ""]}
        rows={items.map((u) => [
          u.id,
          u.nombre,
          u.email,
          <Button
            key="d"
            variant="ghost"
            size="sm"
            onClick={() => remove(u.id)}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>,
        ])}
      />
    </div>
  );
}

type Carrera = { id: number; nombre: string };
function Carreras() {
  const [items, setItems] = useState<Carrera[]>([]);
  const [nombre, setNombre] = useState("");
  async function load() {
    setItems(await api<Carrera[]>("/api/admin/carreras"));
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-5">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva carrera</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/admin/carreras", { method: "POST", body: JSON.stringify({ nombre }) });
              setNombre("");
              load();
            }}
            className="flex gap-3"
          >
            <Input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la carrera"
              className="flex-1"
            />
            <Button type="submit" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>
      <DataTable
        headers={["ID", "Nombre", ""]}
        rows={items.map((c) => [
          c.id,
          c.nombre,
          <Button
            key="d"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api(`/api/admin/carreras/${c.id}`, { method: "DELETE" });
              load();
            }}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>,
        ])}
      />
    </div>
  );
}

type Materia = {
  id: number;
  nombre: string;
  carrera_id: number | null;
  profesor_id: number | null;
  carrera_nombre?: string;
  profesor_nombre?: string;
};
function Materias() {
  const [items, setItems] = useState<Materia[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [profs, setProfs] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ nombre: "", carrera_id: "", profesor_id: "" });
  async function load() {
    const [m, c, p] = await Promise.all([
      api<Materia[]>("/api/admin/materias"),
      api<Carrera[]>("/api/admin/carreras"),
      api<Usuario[]>("/api/admin/usuarios?rol=profesor"),
    ]);
    setItems(m);
    setCarreras(c);
    setProfs(p);
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-5">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva materia</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/admin/materias", {
                method: "POST",
                body: JSON.stringify({
                  nombre: form.nombre,
                  carrera_id: form.carrera_id ? Number(form.carrera_id) : null,
                  profesor_id: form.profesor_id ? Number(form.profesor_id) : null,
                }),
              });
              setForm({ nombre: "", carrera_id: "", profesor_id: "" });
              load();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <Input
              required
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <select
              value={form.carrera_id}
              onChange={(e) => setForm({ ...form, carrera_id: e.target.value })}
              className="input-field"
            >
              <option value="">— Carrera —</option>
              {carreras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.profesor_id}
              onChange={(e) => setForm({ ...form, profesor_id: e.target.value })}
              className="input-field"
            >
              <option value="">— Profesor —</option>
              {profs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <Button type="submit" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>
      <DataTable
        headers={["ID", "Nombre", "Carrera", "Profesor", ""]}
        rows={items.map((m) => [
          m.id,
          m.nombre,
          m.carrera_nombre || "—",
          m.profesor_nombre || "—",
          <Button
            key="d"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api(`/api/admin/materias/${m.id}`, { method: "DELETE" });
              load();
            }}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>,
        ])}
      />
    </div>
  );
}

type Matricula = {
  id: number;
  estudiante_id: number;
  materia_id: number;
  periodo: string;
  estudiante_nombre: string;
  materia_nombre: string;
};
function Matriculas() {
  const [items, setItems] = useState<Matricula[]>([]);
  const [ests, setEsts] = useState<Usuario[]>([]);
  const [mats, setMats] = useState<Materia[]>([]);
  const [form, setForm] = useState({ estudiante_id: "", materia_id: "", periodo: "2026-1" });
  async function load() {
    const [x, e, m] = await Promise.all([
      api<Matricula[]>("/api/admin/matriculas"),
      api<Usuario[]>("/api/admin/usuarios?rol=estudiante"),
      api<Materia[]>("/api/admin/materias"),
    ]);
    setItems(x);
    setEsts(e);
    setMats(m);
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-5">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva matrícula</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/admin/matriculas", {
                method: "POST",
                body: JSON.stringify({
                  estudiante_id: Number(form.estudiante_id),
                  materia_id: Number(form.materia_id),
                  periodo: form.periodo,
                }),
              });
              load();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <select
              required
              value={form.estudiante_id}
              onChange={(e) => setForm({ ...form, estudiante_id: e.target.value })}
              className="input-field"
            >
              <option value="">— Estudiante —</option>
              {ests.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            <select
              required
              value={form.materia_id}
              onChange={(e) => setForm({ ...form, materia_id: e.target.value })}
              className="input-field"
            >
              <option value="">— Materia —</option>
              {mats.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <Input
              required
              placeholder="Periodo"
              value={form.periodo}
              onChange={(e) => setForm({ ...form, periodo: e.target.value })}
            />
            <Button type="submit" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Matricular
            </Button>
          </form>
        </CardContent>
      </Card>
      <DataTable
        headers={["ID", "Estudiante", "Materia", "Periodo", ""]}
        rows={items.map((m) => [
          m.id,
          m.estudiante_nombre,
          m.materia_nombre,
          m.periodo,
          <Button
            key="d"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api(`/api/admin/matriculas/${m.id}`, { method: "DELETE" });
              load();
            }}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>,
        ])}
      />
    </div>
  );
}
