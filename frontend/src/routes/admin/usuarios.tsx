import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { Plus, Search, Pencil, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsuarios,
});

type Usuario = {
  id: number;
  nombre_completo: string;
  correo: string;
  rol: "admin" | "profesor" | "estudiante" | "acudiente";
  estado: "activo" | "inactivo";
  foto_url: string | null;
};

const ROLES: { value: Usuario["rol"]; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "profesor", label: "Profesor" },
  { value: "estudiante", label: "Estudiante" },
  { value: "acudiente", label: "Acudiente" },
];

const rolBadge: Record<Usuario["rol"], string> = {
  admin: "border-violet-200 bg-violet-500/10 text-violet-700",
  profesor: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  estudiante: "border-primary/20 bg-primary/10 text-primary",
  acudiente: "border-sky-200 bg-sky-500/10 text-sky-700",
};

const rolLabel: Record<Usuario["rol"], string> = {
  admin: "Admin",
  profesor: "Profesor",
  estudiante: "Estudiante",
  acudiente: "Acudiente",
};

const emptyForm = {
  nombre_completo: "",
  correo: "",
  password: "",
  rol: "estudiante" as Usuario["rol"],
};

function AdminUsuarios() {
  const [items, setItems] = useState<Usuario[]>([]);
  const [rol, setRol] = useState("");
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (rol) params.set("rol", rol);
      if (q.trim()) params.set("q", q.trim());
      const url = `/api/admin/usuarios${params.toString() ? `?${params.toString()}` : ""}`;
      const data = await api<Usuario[]>(url);
      if (gen === genRef.current) setItems(data);
    } catch (err) {
      if (gen === genRef.current)
        toast.error(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      if (gen === genRef.current) setCargando(false);
    }
  }, [rol, q]);

  // Debounce de la búsqueda: espera 300 ms tras la última pulsación antes de consultar.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function abrirCrear() {
    setEditando(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setForm({ nombre_completo: u.nombre_completo, correo: u.correo, password: "", rol: u.rol });
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editando) {
        const body: Record<string, unknown> = {
          nombre_completo: form.nombre_completo,
          correo: form.correo,
          rol: form.rol,
        };
        if (form.password) body.password = form.password;
        await api(`/api/admin/usuarios/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Usuario actualizado");
      } else {
        await api("/api/admin/usuarios", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Usuario creado");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(u: Usuario) {
    const nuevo = u.estado === "activo" ? "inactivo" : "activo";
    try {
      await api(`/api/admin/usuarios/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevo }),
      });
      toast.success(nuevo === "activo" ? "Usuario activado" : "Usuario deshabilitado");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Usuarios</h2>
          <p className="text-sm text-muted-foreground">Gestiona cuentas del sistema por rol</p>
        </div>
        <Button onClick={abrirCrear} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4">
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="input-field w-full"
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="h-10 w-full rounded-xl border-input bg-background py-2 pl-9 text-sm shadow-sm"
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        loading={cargando}
        headers={["ID", "Nombre", "Correo", "Rol", "Estado", "Acciones"]}
        rows={items.map((u) => [
          u.id,
          <span key="n" className="font-medium">
            {u.nombre_completo}
          </span>,
          u.correo,
          <Badge
            key="r"
            variant="outline"
            className={cn("rounded-full px-2.5 text-xs font-medium", rolBadge[u.rol])}
          >
            {rolLabel[u.rol]}
          </Badge>,
          <Badge
            key="e"
            variant="outline"
            className={cn(
              "rounded-full px-2.5 text-xs font-medium",
              u.estado === "activo"
                ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                : "border-rose-200 bg-rose-500/10 text-rose-700",
            )}
          >
            {u.estado === "activo" ? "Activo" : "Inactivo"}
          </Badge>,
          <div key="a" className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)} className="gap-1">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cambiarEstado(u)}
              className="gap-1 text-muted-foreground"
            >
              {u.estado === "activo" ? "Deshabilitar" : "Activar"}
            </Button>
          </div>,
        ])}
        emptyMessage="No hay usuarios con ese filtro."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/60">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Actualiza los datos de la cuenta. Deja la contraseña vacía para no cambiarla."
                : "Crea una cuenta nueva en el sistema."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                required
                value={form.nombre_completo}
                onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                required
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Contraseña{" "}
                {editando && <span className="text-xs text-muted-foreground">(opcional)</span>}
              </Label>
              <Input
                id="password"
                required={!editando}
                minLength={6}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <select
                id="rol"
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Usuario["rol"] })}
                className="input-field w-full"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando} className="gap-1.5">
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                {editando ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
