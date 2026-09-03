import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Loader2, Trash2, Power, Image, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/instituciones")({
  component: AdminInstituciones,
});

type Institucion = {
  id: number;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  departamento: string | null;
  ciudad: string | null;
  estado: "activo" | "inactivo";
  logo_url: string | null;
};

const emptyForm = {
  nombre: "",
  correo: "",
  telefono: "",
  departamento: "",
  ciudad: "",
  estado: "activo" as "activo" | "inactivo",
  admin_nombre: "",
  admin_email: "",
  admin_password: "",
  logo_url: "",
};

function AdminInstituciones() {
  const [items, setItems] = useState<Institucion[]>([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Institucion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmarEliminar, setConfirmarEliminar] = useState<Institucion | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setCargando(true);
    try {
      const data = await api<Institucion[]>("/api/instituciones");
      if (gen === genRef.current) {
        // Filtrado básico en cliente (o podrías implementarlo en backend si crece)
        const filtrados = q.trim()
          ? data.filter(
              (i) =>
                i.nombre.toLowerCase().includes(q.toLowerCase()) ||
                i.departamento?.toLowerCase().includes(q.toLowerCase()),
            )
          : data;
        setItems(filtrados);
      }
    } catch (err) {
      if (gen === genRef.current)
        toast.error(err instanceof Error ? err.message : "Error al cargar instituciones");
    } finally {
      if (gen === genRef.current) setCargando(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function abrirCrear() {
    setEditando(null);
    setForm(emptyForm);
    setLogoFile(null);
    setLogoPreview(null);
    setOpen(true);
  }

  function abrirEditar(i: Institucion) {
    setEditando(i);
    setForm({
      nombre: i.nombre,
      correo: i.correo || "",
      telefono: i.telefono || "",
      departamento: i.departamento || "",
      ciudad: i.ciudad || "",
      estado: i.estado || "activo",
      admin_nombre: "",
      admin_email: "",
      admin_password: "",
      logo_url: i.logo_url || "",
    });
    if (i.logo_url) {
      setLogoPreview(urlRecurso(i.logo_url));
    } else {
      setLogoPreview(null);
    }
    setLogoFile(null);
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      // Para creación: POST /api/instituciones (JSON) -> si hay logo, subir luego
      // Para edición: PUT /api/instituciones/:id (JSON) -> si hay logo, subir luego
      const metodo = editando ? "PUT" : "POST";
      const url = editando ? `/api/instituciones/${editando.id}` : "/api/instituciones";
      const res = await api<{ id: number }>(url, {
        method: metodo,
        body: JSON.stringify(form),
      });
      const institucionId = res.id ?? editando?.id;

      // Si hay logo nuevo, subirlo
      if (logoFile && institucionId) {
        const logoUrl = await subirLogo(institucionId);
        if (!logoUrl && editando) {
          // Si falló la subida del logo en edición, no revertimos la institución
          toast.warning("Institución guardada, pero falló la subida del logo");
        }
      }

      toast.success(editando ? "Institución actualizada" : "Institución creada");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!confirmarEliminar) return;
    try {
      await api(`/api/instituciones/${confirmarEliminar.id}`, { method: "DELETE" });
      toast.success("Institución eliminada");
      setConfirmarEliminar(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  async function alternarEstado(i: Institucion) {
    try {
      const nuevoEstado = i.estado === "activo" ? "inactivo" : "activo";
      await api(`/api/instituciones/${i.id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      toast.success(nuevoEstado === "activo" ? "Institución activada" : "Institución desactivada");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar el estado");
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Formato no permitido. Use PNG, JPG, SVG o WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo supera el tamaño máximo (2 MB)");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleLogoRemove() {
    setLogoFile(null);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoPreview(null);
    setForm({ ...form, logo_url: "" });
  }

  async function subirLogo(institucionId: number) {
    if (!logoFile) return null;
    setSubiendoLogo(true);
    try {
      const fd = new FormData();
      fd.append("logo", logoFile);
      const res = await api<{ logo_url: string }>(`/api/instituciones/${institucionId}/logo`, {
        method: "POST",
        body: fd,
      });
      return res.logo_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir logo");
      return null;
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function _eliminarLogo(institucionId: number) {
    try {
      await api(`/api/instituciones/${institucionId}/logo`, { method: "DELETE" });
      toast.success("Logo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar logo");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Instituciones</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona las instituciones educativas del sistema
          </p>
        </div>
        <Button onClick={abrirCrear} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva institución
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o departamento..."
              className="h-10 w-full rounded-xl border-input bg-background py-2 pl-9 text-sm shadow-sm"
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        loading={cargando}
        headers={["ID", "Nombre", "Contacto", "Ubicación", "Estado", "Acciones"]}
        rows={items.map((i) => [
          i.id,
          <span key="n" className="font-medium">
            {i.nombre}
          </span>,
          <div key="c" className="flex flex-col text-xs">
            <span>{i.correo || "—"}</span>
            <span className="text-muted-foreground">{i.telefono || "—"}</span>
          </div>,
          <div key="u" className="flex flex-col text-xs">
            <span>{i.departamento || "—"}</span>
            <span className="text-muted-foreground">{i.ciudad || "—"}</span>
          </div>,
          <Badge
            key="e"
            variant={i.estado === "activo" ? "default" : "secondary"}
            className="justify-center"
          >
            {i.estado === "activo" ? "Activa" : "Inactiva"}
          </Badge>,
          <div key="a" className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => abrirEditar(i)} className="gap-1">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => alternarEstado(i)}
              className="gap-1"
              title={i.estado === "activo" ? "Desactivar" : "Activar"}
            >
              <Power className="h-4 w-4" />
              {i.estado === "activo" ? "Desactivar" : "Activar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmarEliminar(i)}
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </div>,
        ])}
        emptyMessage="No hay instituciones registradas."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/60">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar institución" : "Nueva institución"}</DialogTitle>
            <DialogDescription>Completa los datos de la institución educativa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la institución</Label>
              <Input
                id="nombre"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Instituto Técnico Nacional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.estado === "activo" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, estado: "activo" })}
                >
                  Activa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.estado === "inactivo" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, estado: "inactivo" })}
                >
                  Inactiva
                </Button>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Logo de la institución</Label>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-lg border border-border/50 bg-muted/30 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Image className="h-8 w-8 mx-auto opacity-50" />
                      <p className="text-xs mt-1">Sin logo</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoChange}
                      className="sr-only"
                      id="logo_upload"
                      disabled={subiendoLogo}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("logo_upload")?.click()}
                      disabled={subiendoLogo}
                      className="gap-1.5 w-full justify-center"
                    >
                      <Upload className="h-4 w-4" />
                      {logoFile ? "Cambiar logo" : "Subir logo"}
                    </Button>
                  </label>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleLogoRemove}
                      disabled={subiendoLogo}
                      className="gap-1.5 w-full justify-center"
                    >
                      <X className="h-4 w-4" />
                      Quitar logo
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG o WebP · Máx. 2 MB</p>
            </div>

            {!editando && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-sm">Administrador inicial (opcional)</h4>
                <p className="text-xs text-muted-foreground">
                  Si completas estos campos, se creará un usuario administrador para esta
                  institución con acceso inmediato al sistema.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="admin_nombre">Nombre del administrador</Label>
                  <Input
                    id="admin_nombre"
                    value={form.admin_nombre}
                    onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
                    placeholder="Ej. Carlos Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_email">Correo del administrador</Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    placeholder="admin@colegio.edu.co"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_password">Contraseña inicial</Label>
                  <Input
                    id="admin_password"
                    type="password"
                    value={form.admin_password}
                    onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando} className="gap-1.5">
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                {editando ? "Guardar cambios" : "Crear institución"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmarEliminar}
        onOpenChange={(o) => !o && setConfirmarEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la institución <strong>{confirmarEliminar?.nombre}</strong> de
              forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
