import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, urlRecurso } from "@/lib/api";
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
import { Image, Loader2, Upload, X } from "lucide-react";

export type Institucion = {
  id: number;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  departamento: string | null;
  ciudad: string | null;
  estado: "activo" | "inactivo";
  logo_url: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editando: Institucion | null;
  onSaved: () => void;
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

export function InstitucionModal({ open, onOpenChange, editando, onSaved }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  function abrir() {
    if (editando) {
      setForm({
        nombre: editando.nombre,
        correo: editando.correo || "",
        telefono: editando.telefono || "",
        departamento: editando.departamento || "",
        ciudad: editando.ciudad || "",
        estado: editando.estado || "activo",
        admin_nombre: "",
        admin_email: "",
        admin_password: "",
        logo_url: editando.logo_url || "",
      });
      setLogoPreview(editando.logo_url ? urlRecurso(editando.logo_url) : null);
    } else {
      setForm(emptyForm);
      setLogoPreview(null);
    }
    setLogoFile(null);
  }

  // Reinicia el formulario cada vez que se abre el diálogo (nuevo o edición).
  useEffect(() => {
    if (open) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editando]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      const metodo = editando ? "PUT" : "POST";
      const url = editando ? `/api/instituciones/${editando.id}` : "/api/instituciones";
      const res = await api<{ id: number }>(url, {
        method: metodo,
        body: JSON.stringify(form),
      });
      const institucionId = res.id ?? editando?.id;

      if (logoFile && institucionId) {
        const logoUrl = await subirLogo(institucionId);
        if (!logoUrl && editando) {
          toast.warning("Institución guardada, pero falló la subida del logo");
        }
      }

      toast.success(editando ? "Institución actualizada" : "Institución creada");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
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
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setForm({ ...form, logo_url: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                Si completas estos campos, se creará un usuario administrador para esta institución
                con acceso inmediato al sistema.
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
