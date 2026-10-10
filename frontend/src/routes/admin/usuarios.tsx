import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, urlRecurso } from "@/lib/api";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Loader2,
  Upload,
  X,
  Check,
  FileSpreadsheet,
  Download,
  FileUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
  { value: "profesor", label: "Docente" },
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
  profesor: "Docente",
  estudiante: "Estudiante",
  acudiente: "Acudiente",
};

const emptyForm = {
  nombre_completo: "",
  correo: "",
  password: "",
  rol: "estudiante" as Usuario["rol"],
};

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function AvatarUsuario({
  fotoUrl,
  nombre,
  className,
}: {
  fotoUrl: string | null;
  nombre: string;
  className?: string;
}) {
  return (
    <Avatar
      className={cn(
        "h-9 w-9 rounded-full border border-border/60 bg-gradient-to-br from-primary/10 to-violet-500/10",
        className,
      )}
    >
      {fotoUrl ? <AvatarImage src={urlRecurso(fotoUrl)} alt={nombre} /> : null}
      <AvatarFallback className="rounded-full text-xs font-semibold">
        {iniciales(nombre)}
      </AvatarFallback>
    </Avatar>
  );
}

// ---------- Carga masiva de usuarios (CSV / XLSX) ----------

type FilaExito = {
  fila: number;
  id: number;
  nombre: string;
  correo: string;
  rol: string;
};

type FilaError = {
  fila: number;
  correo: string;
  motivo: string;
};

type ResultadoCarga = {
  total: number;
  insertados: number;
  fallidos: number;
  exitosos: FilaExito[];
  fallidos: FilaError[];
};

function descargarPlantilla() {
  const contenido = [
    "nombre,correo,rol,password",
    "Ana García,ana.garcia@correo.com,Profesor,Clave123",
    "Luis Pérez,luis.perez@correo.com,Estudiante,Clave456",
  ].join("\r\n");
  // BOM para que Excel muestre bien los acentos.
  const blob = new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_carga_usuarios.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ResumenCarga({ resultado }: { resultado: ResultadoCarga }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
          <div className="text-lg font-bold">{resultado.total}</div>
          <div className="text-xs text-muted-foreground">Filas</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-500/10 p-2.5">
          <div className="text-lg font-bold text-emerald-700">{resultado.insertados}</div>
          <div className="text-xs text-muted-foreground">Insertados</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-500/10 p-2.5">
          <div className="text-lg font-bold text-rose-700">{resultado.fallidos}</div>
          <div className="text-xs text-muted-foreground">Con errores</div>
        </div>
      </div>

      {resultado.fallidos.length > 0 && (
        <div className="max-h-44 overflow-y-auto rounded-xl border border-rose-200 bg-rose-500/5">
          <div className="border-b border-rose-200 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700">
            Fallos ({resultado.fallidos.length})
          </div>
          <ul className="divide-y divide-border/60">
            {resultado.fallidos.map((f) => (
              <li
                key={`f-${f.fila}-${f.correo}`}
                className="flex items-start gap-2 px-3 py-2 text-xs"
              >
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                <span className="shrink-0 text-muted-foreground">Fila {f.fila}:</span>
                <span className="min-w-0 break-words font-medium">{f.correo || "—"}</span>
                <span className="min-w-0 break-words text-muted-foreground">— {f.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.exitosos.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-500/5">
          <div className="border-b border-emerald-200 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700">
            Insertados ({resultado.exitosos.length})
          </div>
          <ul className="divide-y divide-border/60">
            {resultado.exitosos.map((e) => (
              <li key={`e-${e.id}`} className="flex items-start gap-2 px-3 py-2 text-xs">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="font-medium">{e.nombre}</span>
                <span className="text-muted-foreground">
                  ({e.correo} · {e.rol})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CargaMasivaModal({
  onOpenChange,
  onExito,
}: {
  onOpenChange: (open: boolean) => void;
  onExito: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function elegirArchivo(f: File | null) {
    if (!f) return;
    const ext = f.name.toLowerCase().split(".").pop();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      toast.error("El archivo debe ser .csv o .xlsx");
      return;
    }
    setArchivo(f);
    setResultado(null);
  }

  async function subir() {
    if (!archivo) return;
    setEnviando(true);
    setResultado(null);
    try {
      const data = new FormData();
      data.append("archivo", archivo);
      const res = await api<ResultadoCarga>("/api/usuarios/carga-masiva", {
        method: "POST",
        body: data,
      });
      setResultado(res);
      if (res.insertados > 0 && res.fallidos === 0)
        toast.success(`${res.insertados} usuarios insertados correctamente`);
      else if (res.insertados > 0)
        toast.info(`${res.insertados} insertados · ${res.fallidos} con errores`);
      else toast.error("Ningún usuario se pudo insertar");
      onExito();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col rounded-2xl border-border/60 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Carga masiva de usuarios</DialogTitle>
          <DialogDescription>
            Sube un archivo .csv o .xlsx con las columnas: nombre, correo, rol y password.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">
            ¿No sabes cómo estructurar el archivo?
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={descargarPlantilla}
          >
            <Download className="h-3.5 w-3.5" />
            Descargar plantilla
          </Button>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 border-dashed border-border/70 bg-muted/30 px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/50",
            archivo && "border-primary/60 bg-primary/5 text-foreground",
          )}
        >
          {archivo ? (
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <FileUp className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate">
            {archivo ? archivo.name : "Selecciona un archivo CSV o Excel (.xlsx)"}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            elegirArchivo(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        {enviando ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando el archivo...
          </div>
        ) : resultado ? (
          <ResumenCarga resultado={resultado} />
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>
          <Button type="button" disabled={!archivo || enviando} onClick={subir} className="gap-1.5">
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {enviando ? "Procesando..." : resultado ? "Subir otro archivo" : "Subir y procesar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminUsuarios() {
  const [items, setItems] = useState<Usuario[]>([]);
  const [rol, setRol] = useState("");
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [open, setOpen] = useState(false);
  const [cargaAbierta, setCargaAbierta] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // foto de perfil: archivo elegido + vista previa + marca de "quitada"
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fotoEliminada, setFotoEliminada] = useState(false);

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

  function liberarVistaPrevia() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }

  function abrirCrear() {
    liberarVistaPrevia();
    setEditando(null);
    setForm(emptyForm);
    setArchivo(null);
    setPreviewUrl(null);
    setFotoEliminada(false);
    setOpen(true);
  }

  function abrirEditar(u: Usuario) {
    liberarVistaPrevia();
    setEditando(u);
    setForm({ nombre_completo: u.nombre_completo, correo: u.correo, password: "", rol: u.rol });
    setArchivo(null);
    setPreviewUrl(u.foto_url ? urlRecurso(u.foto_url) : null);
    setFotoEliminada(false);
    setOpen(true);
  }

  function elegirArchivo(f: File | null) {
    liberarVistaPrevia();
    setArchivo(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    setFotoEliminada(false);
  }

  function quitarFoto() {
    liberarVistaPrevia();
    setArchivo(null);
    setPreviewUrl(null);
    setFotoEliminada(!!editando?.foto_url);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando && !form.password) return;
    setGuardando(true);
    try {
      // Siempre FormData: el backend usa multer y así la foto viaja en el mismo request.
      const data = new FormData();
      data.append("nombre_completo", form.nombre_completo);
      data.append("correo", form.correo);
      data.append("rol", form.rol);
      if (!editando || form.password) data.append("password", form.password);
      if (archivo) data.append("foto", archivo);
      else if (fotoEliminada) data.append("quitar_foto", "true");
      await api(editando ? `/api/admin/usuarios/${editando.id}` : "/api/admin/usuarios", {
        method: editando ? "PUT" : "POST",
        body: data,
      });
      toast.success(editando ? "Usuario actualizado" : "Usuario creado");
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCargaAbierta(true)} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Carga Masiva
          </Button>
          <Button onClick={abrirCrear} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
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
          <div key="n" className="flex items-center gap-3">
            <AvatarUsuario fotoUrl={u.foto_url} nombre={u.nombre_completo} />
            <span className="font-medium">{u.nombre_completo}</span>
          </div>,
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
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 rounded-2xl border border-border/60">
                {previewUrl ? <AvatarImage src={previewUrl} alt={form.nombre_completo} /> : null}
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 text-lg font-bold">
                  {form.nombre_completo ? iniciales(form.nombre_completo) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="foto" className="sr-only">
                  Foto de perfil
                </Label>
                <label
                  htmlFor="foto"
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/50",
                    archivo && "border-primary/60 bg-primary/5 text-foreground",
                  )}
                >
                  {archivo ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Upload className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {archivo ? archivo.name : "Subir foto — JPG · PNG · WEBP · 3 MB"}
                  </span>
                </label>
                <Input
                  id="foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    elegirArchivo(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                {(archivo || fotoEliminada || (editando?.foto_url && previewUrl)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={quitarFoto}
                  >
                    <X className="h-3.5 w-3.5" />
                    Quitar foto
                  </Button>
                )}
              </div>
            </div>
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

      {cargaAbierta && <CargaMasivaModal onOpenChange={setCargaAbierta} onExito={() => load()} />}
    </div>
  );
}
