import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Power, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InstitucionModal, type Institucion } from "@/components/InstitucionModal";
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

function AdminInstituciones() {
  const [items, setItems] = useState<Institucion[]>([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Institucion | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<Institucion | null>(null);

  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setCargando(true);
    try {
      const data = await api<Institucion[]>("/api/instituciones");
      if (gen === genRef.current) {
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
    setOpen(true);
  }

  function abrirEditar(i: Institucion) {
    setEditando(i);
    setOpen(true);
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

      <InstitucionModal open={open} onOpenChange={setOpen} editando={editando} onSaved={load} />

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
