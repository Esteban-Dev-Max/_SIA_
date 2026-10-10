import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  Eye,
  FileText,
  GraduationCap,
  IdCard,
  Inbox,
  Loader2,
  Paperclip,
  RefreshCw,
  Save,
  Upload,
  Users,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { api, descargarArchivo, urlRecurso, vistaArchivo } from "@/lib/api";
import { useAsistenciaOffline } from "@/hooks/use-asistencia-offline";
import { EscaneoAsistencia } from "@/components/EscaneoAsistencia";
import { CarnetsAsistencia } from "@/components/CarnetsAsistencia";
import { JustificacionEditor } from "@/components/JustificacionEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import { esFechaPasada } from "@/lib/asistencia";
import type { EstadoAsistencia } from "@/lib/asistencia";

type RegistroAsistencia = {
  matricula_id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  foto_url: string | null;
  codigo_carnet: string | null;
  fecha: string | null;
  estado: EstadoAsistencia | null;
  observacion: string | null;
  asistencia_id: number | null;
  archivo_ruta: string | null;
  archivo_mime: string | null;
  archivo_nombre: string | null;
};

const ESTADOS_ASISTENCIA: { value: EstadoAsistencia; label: string }[] = [
  { value: "presente", label: "Presente" },
  { value: "ausente", label: "Ausente" },
  { value: "tarde", label: "Tarde" },
  { value: "excusa", label: "Excusa" },
];

const ESTILOS_PILL: Record<EstadoAsistencia, string> = {
  presente: "bg-emerald-500 text-white border-emerald-500",
  ausente: "bg-rose-500 text-white border-rose-500",
  tarde: "bg-amber-500 text-white border-amber-500",
  excusa: "bg-sky-500 text-white border-sky-500",
};

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function etiquetaMime(mime: string | null): string {
  if (!mime) return "Adjunto";
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  return mime.split("/")[1]?.toUpperCase() ?? "Adjunto";
}

function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AsistenciaTab({
  sel,
  grupoLabel,
  onGuardar,
}: {
  sel: number | null;
  grupoLabel?: string;
  onGuardar?: () => void;
}) {
  const { online, pendientes, sincronizando, encolar, sincronizar } = useAsistenciaOffline();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<RegistroAsistencia | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [modoEscaneo, setModoEscaneo] = useState(false);
  const [carnetsAbiertos, setCarnetsAbiertos] = useState(false);
  const [justif, setJustif] = useState<{
    matricula_id: number;
    anterior: EstadoAsistencia | null;
    estado: EstadoAsistencia;
  } | null>(null);

  useEffect(() => {
    if (!sel) return;
    let activo = true;
    setCargando(true);
    api<{ fecha: string; registros: RegistroAsistencia[] }>(
      `/api/asistencia/grupo/${sel}?fecha=${fecha}`,
    )
      .then((d) => {
        if (activo) setRegistros(d.registros);
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "Error al cargar asistencia");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [sel, fecha]);

  function refrescar() {
    if (!sel) return;
    setCargando(true);
    api<{ fecha: string; registros: RegistroAsistencia[] }>(
      `/api/asistencia/grupo/${sel}?fecha=${fecha}`,
    )
      .then((d) => setRegistros(d.registros))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar asistencia"),
      )
      .finally(() => setCargando(false));
  }

  const totales = {
    estudiantes: registros.length,
    presentes: 0,
    ausentes: 0,
    tardes: 0,
    excusas: 0,
    sinMarcar: 0,
  };
  for (const reg of registros) {
    if (!reg.estado) totales.sinMarcar += 1;
    else if (reg.estado === "presente") totales.presentes += 1;
    else if (reg.estado === "ausente") totales.ausentes += 1;
    else if (reg.estado === "tarde") totales.tardes += 1;
    else if (reg.estado === "excusa") totales.excusas += 1;
  }

  function marcaPendiente(reg: RegistroAsistencia, estado: EstadoAsistencia): boolean {
    return reg.estado != null && estado !== reg.estado && esFechaPasada(fecha);
  }

  function cambiarEstado(reg: RegistroAsistencia, estado: EstadoAsistencia) {
    if (estado === "excusa") {
      setRegistros((prev) =>
        prev.map((r) => (r.matricula_id === reg.matricula_id ? { ...r, estado } : r)),
      );
      abrirExcusa(reg);
      return;
    }
    if (marcaPendiente(reg, estado)) {
      setJustif({ matricula_id: reg.matricula_id, anterior: reg.estado, estado });
      return;
    }
    setRegistros((prev) =>
      prev.map((r) => (r.matricula_id === reg.matricula_id ? { ...r, estado } : r)),
    );
    void guardarFila(reg.matricula_id, estado, null);
  }

  async function guardarFila(
    matricula_id: number,
    estado: EstadoAsistencia,
    justificacion: string | null,
  ) {
    if (!sel) return;
    const reg = registros.find((r) => r.matricula_id === matricula_id);
    setGuardando((prev) => new Set(prev).add(matricula_id));
    try {
      if (!online) {
        encolar({
          grupo_id: sel,
          fecha,
          ...(justificacion ? { justificacion } : {}),
          registros: registros.map((r) => ({
            matricula_id: r.matricula_id,
            estado: r.estado ?? "presente",
            observacion: r.observacion ?? null,
          })),
        });
        toast.info("Sin conexión: el cambio quedó guardado localmente");
      } else {
        await api("/api/asistencia/registrar", {
          method: "POST",
          body: JSON.stringify({
            grupo_id: sel,
            fecha,
            ...(justificacion ? { justificacion } : {}),
            registros: [{ matricula_id, estado, observacion: reg?.observacion ?? null }],
          }),
        });
        toast.success(`Asistencia de ${reg?.estudiante ?? matricula_id} actualizada`);
        onGuardar?.();
        refrescar();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la asistencia");
    } finally {
      setGuardando((prev) => {
        const next = new Set(prev);
        next.delete(matricula_id);
        return next;
      });
    }
  }

  async function marcarTodosPresentes() {
    if (!sel) return;
    const pendientesMarcado = registros.filter((r) => !r.estado);
    if (pendientesMarcado.length === 0) {
      toast.info("Todos los estudiantes ya tienen marca");
      return;
    }
    setRegistros((prev) => prev.map((r) => (r.estado ? r : { ...r, estado: "presente" })));
    try {
      if (!online) {
        encolar({
          grupo_id: sel,
          fecha,
          registros: registros.map((r) => ({
            matricula_id: r.matricula_id,
            estado: r.estado ?? "presente",
            observacion: r.observacion ?? null,
          })),
        });
        toast.info(`Sin conexión: ${pendientesMarcado.length} quedaron presentes (local)`);
        return;
      }
      await api("/api/asistencia/registrar", {
        method: "POST",
        body: JSON.stringify({
          grupo_id: sel,
          fecha,
          registros: pendientesMarcado.map((r) => ({
            matricula_id: r.matricula_id,
            estado: "presente",
            observacion: null,
          })),
        }),
      });
      toast.success(`${pendientesMarcado.length} estudiantes marcados presentes`);
      onGuardar?.();
      refrescar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al marcar todos presentes");
    }
  }

  function abrirExcusa(reg: RegistroAsistencia) {
    setArchivo(null);
    setMotivo(reg.observacion ?? "");
    setModal(reg);
  }

  async function guardarExcusa() {
    if (!modal) return;
    setSubiendo(true);
    try {
      const data = new FormData();
      data.append("matricula_id", String(modal.matricula_id));
      data.append("fecha", fecha);
      if (motivo.trim()) data.append("observacion", motivo.trim());
      if (archivo) data.append("archivo", archivo);
      await api("/api/asistencia/excusa", { method: "POST", body: data });
      toast.success(`Excusa de ${modal.estudiante} guardada`);
      setModal(null);
      onGuardar?.();
      refrescar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la excusa");
    } finally {
      setSubiendo(false);
    }
  }

  function verAdjunto(reg: RegistroAsistencia) {
    vistaArchivo(
      `/api/asistencia/excusa/descargar?matricula_id=${reg.matricula_id}&fecha=${fecha}`,
    ).catch((err) => toast.error(err instanceof Error ? err.message : "Error al abrir el adjunto"));
  }

  function bajarAdjunto(reg: RegistroAsistencia) {
    descargarArchivo(
      `/api/asistencia/excusa/descargar?matricula_id=${reg.matricula_id}&fecha=${fecha}`,
      reg.archivo_nombre ?? "excusa",
    ).catch((err) => toast.error(err instanceof Error ? err.message : "Error al descargar"));
  }

  function cancelarJustificacion() {
    if (!justif) return;
    setRegistros((prev) =>
      prev.map((r) =>
        r.matricula_id === justif.matricula_id ? { ...r, estado: justif.anterior } : r,
      ),
    );
    setJustif(null);
  }

  async function confirmarJustificacion(texto: string) {
    if (!justif) return;
    setRegistros((prev) =>
      prev.map((r) =>
        r.matricula_id === justif.matricula_id ? { ...r, estado: justif.estado } : r,
      ),
    );
    const { matricula_id, estado } = justif;
    setJustif(null);
    await guardarFila(matricula_id, estado, texto);
  }

  const haySinMarcar = totales.sinMarcar > 0;
  const fechaPasada = esFechaPasada(fecha);

  return (
    <>
      {!online && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-500/10">
          <CardHeader className="py-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
              <WifiOff className="h-4 w-4" />
              Sin conexión: los cambios se guardan en este equipo y se sincronizarán automáticamente
              al recuperar la red.
            </CardTitle>
          </CardHeader>
        </Card>
      )}
      {!online && pendientes.length > 0 && (
        <Card className="mb-4 border-border/50 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                {pendientes.length} toma{pendientes.length > 1 ? "s" : ""} pendiente
                {pendientes.length > 1 ? "s" : ""} de sincronizar
              </span>
              <Button
                size="sm"
                onClick={() => void sincronizar()}
                disabled={sincronizando}
                className="gap-1.5 h-8 rounded-lg"
              >
                {sincronizando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sincronizar ahora
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <Card className="mb-4 border-border/50 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
              Asistencia del día
              {fechaPasada && (
                <Badge
                  variant="outline"
                  className="rounded-full border-amber-200 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                >
                  Día anterior: editar exige justificación
                </Badge>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={fecha}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFecha(e.target.value)}
                className="w-auto h-9 rounded-lg border-border/60 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModoEscaneo((v) => !v)}
                disabled={!sel}
                className="gap-1.5 h-9 rounded-lg border-border/60"
              >
                {modoEscaneo ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {modoEscaneo ? "Ver lista" : "Escáner QR"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCarnetsAbiertos(true)}
                disabled={!sel}
                className="gap-1.5 h-9 rounded-lg border-border/60"
              >
                <IdCard className="h-3.5 w-3.5" />
                Carnés QR
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {modoEscaneo ? (
        sel && (
          <EscaneoAsistencia
            key="escaneo"
            grupoId={sel}
            fecha={fecha}
            onMarcado={() => {
              onGuardar?.();
              refrescar();
            }}
          />
        )
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Total estudiantes"
              value={totales.estudiantes}
              icon={Users}
              accent="primary"
            />
            <StatCard
              label="Presentes"
              value={totales.presentes}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard label="Ausentes" value={totales.ausentes} icon={XCircle} accent="rose" />
            <StatCard label="Llegadas tarde" value={totales.tardes} icon={Clock} accent="amber" />
            <StatCard label="Con excusa" value={totales.excusas} icon={FileText} accent="sky" />
            <StatCard
              label="Sin marcar"
              value={totales.sinMarcar}
              icon={CheckSquare}
              accent={haySinMarcar ? "amber" : "muted"}
            />
          </div>

          <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-2.5">
              <span className="text-sm font-medium">
                Marca a los estudiantes en 2 clics: toca el estado o
                <button
                  type="button"
                  onClick={() => void marcarTodosPresentes()}
                  disabled={guardando.size > 0}
                  className="mx-1 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  marcar todos presentes
                </button>
              </span>
              {haySinMarcar && (
                <Badge variant="secondary" className="rounded-full px-2.5">
                  {totales.sinMarcar} sin marcar
                </Badge>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Estudiante
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Carné / Correo
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Estado de asistencia
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                    Acciones / Justificación
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm font-medium">Cargando asistencia...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {registros.map((reg, i) => {
                      const actual = reg.estado;
                      const ocupado = guardando.has(reg.matricula_id);
                      return (
                        <TableRow
                          key={reg.matricula_id}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                          )}
                        >
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border/60">
                                {reg.foto_url ? (
                                  <AvatarImage
                                    src={urlRecurso(reg.foto_url)}
                                    alt={reg.estudiante}
                                  />
                                ) : null}
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-700 text-xs font-semibold">
                                  {iniciales(reg.estudiante)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="font-medium">{reg.estudiante}</div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                            <div className="font-mono text-xs">{reg.codigo_carnet ?? "—"}</div>
                            <div className="max-w-[180px] truncate text-xs">{reg.correo}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {ocupado ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Guardando...
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
                                {ESTADOS_ASISTENCIA.map((e) => (
                                  <button
                                    key={e.value}
                                    type="button"
                                    disabled={guardando.size > 0}
                                    onClick={() => cambiarEstado(reg, e.value)}
                                    className={cn(
                                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                                      actual === e.value
                                        ? ESTILOS_PILL[e.value]
                                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground disabled:opacity-50",
                                    )}
                                  >
                                    {e.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {!actual && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-border bg-muted px-2 py-0 text-[10px] font-semibold text-muted-foreground"
                                >
                                  Sin marcar
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Adjuntar excusa"
                                disabled={guardando.size > 0}
                                onClick={() => abrirExcusa(reg)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                              {reg.archivo_ruta && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => abrirExcusa(reg)}
                                  className="h-8 gap-1 rounded-full border border-sky-300 bg-sky-500/10 px-2.5 text-xs font-medium text-sky-700 hover:bg-sky-500/20"
                                >
                                  <Eye className="h-3 w-3" />
                                  Ver Excusa
                                </Button>
                              )}
                              {reg.observacion && (
                                <span
                                  title={reg.observacion}
                                  className="max-w-[140px] truncate text-xs text-muted-foreground"
                                >
                                  {reg.observacion}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {registros.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                              <Inbox className="h-6 w-6 opacity-40" />
                            </div>
                            <span className="text-sm font-medium">
                              {sel
                                ? "Sin alumnos matriculados en este grupo."
                                : "Selecciona un grupo para tomar asistencia."}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <JustificacionEditor
        open={justif !== null}
        onOpenChange={(open) => {
          if (!open) cancelarJustificacion();
        }}
        onConfirmar={(texto) => void confirmarJustificacion(texto)}
        guardando={guardando.size > 0}
      />

      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pr-10">
            <DialogTitle>Adjuntar excusa</DialogTitle>
            <DialogDescription>
              Documento de soporte de {modal?.estudiante} para la fecha {fecha}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid w-full gap-5">
            {modal?.archivo_ruta ? (
              <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-5">{modal.archivo_nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {etiquetaMime(modal.archivo_mime)} · soporte cargado
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-8 px-2.5"
                    onClick={() => verAdjunto(modal)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ver</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-8 px-2.5"
                    onClick={() => bajarAdjunto(modal)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Descargar</span>
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="excusa-adjunto" className="text-sm font-medium">
                Adjuntar soporte
              </Label>
              <label
                htmlFor="excusa-adjunto"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border/70 bg-muted/30 px-4 py-3.5 text-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 hover:border-primary/60 hover:bg-muted/50",
                  archivo && "border-emerald-500/60 bg-emerald-500/5",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground",
                    archivo && "bg-emerald-500/10 text-emerald-600",
                  )}
                >
                  <Upload className="h-4.5 w-4.5" />
                </div>
                <span className="min-w-0 flex-1 truncate">
                  {archivo ? archivo.name : "Haz clic para elegir un archivo"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {archivo ? tamanoArchivo(archivo.size) : "PDF · JPG · PNG · 5 MB"}
                </span>
              </label>
              <Input
                id="excusa-adjunto"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="sr-only"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              {archivo ? (
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={() => setArchivo(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Quitar archivo
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="excusa-motivo" className="text-sm font-medium">
                Observación / Motivo
              </Label>
              <Textarea
                id="excusa-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: Cita médica, calamidad familiar, permiso institucional..."
                className="w-full min-h-[100px] resize-y rounded-xl"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
            <Button variant="outline" onClick={() => setModal(null)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={guardarExcusa}
              disabled={subiendo}
              className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white sm:w-auto"
            >
              {subiendo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {modal?.archivo_ruta ? "Guardar cambios" : "Subir excusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {carnetsAbiertos && sel && (
        <CarnetsAsistencia
          grupoId={sel}
          grupoLabel={grupoLabel ?? `Clase ${sel}`}
          fecha={fecha}
          onClose={() => setCarnetsAbiertos(false)}
        />
      )}
    </>
  );
}
