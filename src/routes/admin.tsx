import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireRole("admin"),
  component: AdminPanel,
});

type Tab = "estudiantes" | "profesores" | "carreras" | "materias" | "matriculas";

function AdminPanel() {
  const [tab, setTab] = useState<Tab>("estudiantes");
  return (
    <PanelShell title="Panel Administrador">
      <div className="mb-6 flex flex-wrap gap-2">
        {(["estudiantes", "profesores", "carreras", "materias", "matriculas"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "estudiantes" && <Usuarios rol="estudiante" />}
      {tab === "profesores" && <Usuarios rol="profesor" />}
      {tab === "carreras" && <Carreras />}
      {tab === "materias" && <Materias />}
      {tab === "matriculas" && <Matriculas />}
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
    <div className="space-y-4">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <input
          required
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Agregar</button>
        {err && <p className="col-span-full text-sm text-destructive">{err}</p>}
      </form>
      <Table
        headers={["ID", "Nombre", "Email", ""]}
        rows={items.map((u) => [
          u.id,
          u.nombre,
          u.email,
          <button key="d" onClick={() => remove(u.id)} className="text-destructive hover:underline">
            Eliminar
          </button>,
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
    <div className="space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/admin/carreras", { method: "POST", body: JSON.stringify({ nombre }) });
          setNombre("");
          load();
        }}
        className="flex gap-2 rounded-lg border bg-card p-4"
      >
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la carrera"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Agregar</button>
      </form>
      <Table
        headers={["ID", "Nombre", ""]}
        rows={items.map((c) => [
          c.id,
          c.nombre,
          <button
            key="d"
            onClick={async () => {
              await api(`/api/admin/carreras/${c.id}`, { method: "DELETE" });
              load();
            }}
            className="text-destructive hover:underline"
          >
            Eliminar
          </button>,
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
    <div className="space-y-4">
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
        className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-4 sm:grid-cols-4"
      >
        <input
          required
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          value={form.carrera_id}
          onChange={(e) => setForm({ ...form, carrera_id: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
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
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Profesor —</option>
          {profs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Agregar</button>
      </form>
      <Table
        headers={["ID", "Nombre", "Carrera", "Profesor", ""]}
        rows={items.map((m) => [
          m.id,
          m.nombre,
          m.carrera_nombre || "—",
          m.profesor_nombre || "—",
          <button
            key="d"
            onClick={async () => {
              await api(`/api/admin/materias/${m.id}`, { method: "DELETE" });
              load();
            }}
            className="text-destructive hover:underline"
          >
            Eliminar
          </button>,
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
    <div className="space-y-4">
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
        className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-4 sm:grid-cols-4"
      >
        <select
          required
          value={form.estudiante_id}
          onChange={(e) => setForm({ ...form, estudiante_id: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
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
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Materia —</option>
          {mats.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Periodo"
          value={form.periodo}
          onChange={(e) => setForm({ ...form, periodo: e.target.value })}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Matricular</button>
      </form>
      <Table
        headers={["ID", "Estudiante", "Materia", "Periodo", ""]}
        rows={items.map((m) => [
          m.id,
          m.estudiante_nombre,
          m.materia_nombre,
          m.periodo,
          <button
            key="d"
            onClick={async () => {
              await api(`/api/admin/matriculas/${m.id}`, { method: "DELETE" });
              load();
            }}
            className="text-destructive hover:underline"
          >
            Eliminar
          </button>,
        ])}
      />
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-muted-foreground">
                Sin datos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
