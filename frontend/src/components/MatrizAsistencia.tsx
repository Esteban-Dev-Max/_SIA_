import { useState } from "react";
import { toast } from "sonner";
import { Inbox, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { JustificacionEditor } from "@/components/JustificacionEditor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ESTADO_LETRA,
  ESTADO_NOMBRE,
  NIVEL_DOT,
  cicloEstado,
  columnasFecha,
  esFechaPasada,
  estadoDe,
  formatoFecha,
  type EstadoAsistencia,
  type FilaResumen,
} from "@/lib/asistencia";

const ESTILO_CELDA: Record<EstadoAsistencia, string> = {
  presente: "border-emerald-300 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25",
  ausente: "border-rose-300 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25",
  tarde: "border-amber-300 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25",
  excusa: "border-sky-300 bg-sky-500/15 text-sky-700 hover:bg-sky-500/25",
};

const LEYENDA: { estado: EstadoAsistencia; nombre: string }[] = [
  { estado: "presente", nombre: "Presente" },
  { estado: "ausente", nombre: "Ausente" },
  { estado: "tarde", nombre: "Llegada tarde" },
  { estado: "excusa", nombre: "Excusa" },
];

export function MatrizAsistencia({
  sel,
  filas,
  cargando,
  onGuardado,
}: {
  sel: number | null;
  filas: FilaResumen[];
  cargando: boolean;
  onGuardado?: () => void;
}) {
  const [guardando, setGuardando] = useState<Set<string>>(new Set());
  const [justif, setJustif] = useState<{
    fila: FilaResumen;
    fecha: string;
    estado: EstadoAsistencia;
  } | null>(null);
  const fechas = columnasFecha(filas);

  function marcarLlave(filaId: number, fecha: string, presente: boolean) {
    setGuardando((prev) => {
      const next = new Set(prev);
      const key = `${filaId}-${fecha}`;
      if (presente) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function persistir(
    fila: FilaResumen,
    fecha: string,
    estado: EstadoAsistencia,
    justificacion?: string,
  ) {
    if (!sel || !fila.matricula_id) return;
    marcarLlave(fila.estudiante_id, fecha, true);
    try {
      await api("/api/asistencia/registrar", {
        method: "POST",
        body: JSON.stringify({
          grupo_id: sel,
          fecha,
          ...(justificacion ? { justificacion } : {}),
          registros: [{ matricula_id: fila.matricula_id, estado, observacion: null }],
        }),
      });
      toast.success(`Asistencia del ${formatoFecha(fecha)} actualizada (${ESTADO_NOMBRE[estado]})`);
      onGuardado?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la asistencia");
    } finally {
      marcarLlave(fila.estudiante_id, fecha, false);
    }
  }

  function pulsar(fila: FilaResumen, fecha: string) {
    if (!sel || !fila.matricula_id) return;
    const actual = estadoDe(fila, fecha);
    const nuevo = cicloEstado(actual);
    // Editar una marca ya existente de un día anterior exige justificación.
    if (actual && esFechaPasada(fecha)) {
      setJustif({ fila, fecha, estado: nuevo });
      return;
    }
    void persistir(fila, fecha, nuevo);
  }

  return (
    <>
      <div className="max-h-[28rem] overflow-auto">
        {cargando ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Cargando matriz...</span>
          </div>
        ) : filas.length === 0 || fechas.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <Inbox className="h-6 w-6 opacity-40" />
            </div>
            <span className="text-sm font-medium">
              {sel
                ? "Sin registros de asistencia en el rango seleccionado."
                : "Selecciona un grupo para ver la matriz."}
            </span>
          </div>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/80 to-muted/50 hover:from-muted/80 hover:to-muted/50">
                <TableHead className="sticky left-0 top-0 z-20 min-w-[220px] bg-muted/80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  Estudiante
                </TableHead>
                {fechas.map((f) => (
                  <TableHead
                    key={f}
                    className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    <span className="block whitespace-nowrap">{formatoFecha(f)}</span>
                    <span className="block text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
                      1 clic = cambiar
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila, i) => (
                <TableRow
                  key={fila.estudiante_id}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                    fila.nivel === "critico" && "bg-rose-500/5 hover:bg-rose-500/10",
                    fila.nivel === "alerta" && "bg-amber-500/5 hover:bg-amber-500/10",
                  )}
                >
                  <TableCell className="sticky left-0 z-10 bg-background px-4 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", NIVEL_DOT[fila.nivel])}
                          title={fila.nivel}
                        />
                        <span className="max-w-[150px] truncate text-sm font-medium">
                          {fila.estudiante}
                        </span>
                      </div>
                      {fila.nivel === "critico" && (
                        <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                          Riesgo
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {fechas.map((f) => {
                    const estado = estadoDe(fila, f);
                    const reg = fila.registros.find((r) => r.fecha === f);
                    const obs = reg?.observacion ?? null;
                    const key = `${fila.estudiante_id}-${f}`;
                    const ocupado = guardando.has(key);
                    const auditado = reg?.modificado_por && reg?.fecha_modificacion;
                    const titulo =
                      (estado ? `${ESTADO_NOMBRE[estado]}` : "Sin registro — clic para marcar") +
                      (obs ? ` · ${obs}` : "") +
                      (auditado
                        ? `\nEditada el ${reg?.fecha_modificacion} por ${reg?.modificado_por}${reg?.justificacion ? ` — Just.: ${reg.justificacion}` : ""}`
                        : "");
                    return (
                      <TableCell key={f} className="px-1.5 py-1.5 text-center">
                        <button
                          type="button"
                          disabled={!sel || ocupado}
                          onClick={() => pulsar(fila, f)}
                          title={titulo}
                          className={cn(
                            "flex h-8 w-full min-w-9 items-center justify-center rounded-lg border text-xs font-bold transition-colors",
                            estado
                              ? ESTILO_CELDA[estado]
                              : "border-dashed border-border/70 text-muted-foreground/60 hover:bg-muted/60",
                            ocupado && "cursor-wait border-border bg-muted text-muted-foreground",
                            auditado && "ring-1 ring-amber-300/60",
                          )}
                        >
                          {ocupado ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            (estado && ESTADO_LETRA[estado]) || <span className="text-xs">·</span>
                          )}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {!cargando && filas.length > 0 && fechas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4 border-t border-border/50 bg-muted/20 px-4 py-2.5">
          {LEYENDA.map((l) => (
            <span
              key={l.estado}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className={cn("h-3.5 w-3.5 rounded border", ESTILO_CELDA[l.estado])}
                aria-hidden
              />
              {l.nombre}
            </span>
          ))}
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            <span className="mr-1 inline-block h-2 w-2 rounded-full border border-amber-300 bg-amber-400/40" />
            borde ámbar = celda editada (verificable en la bitácora)
          </span>
        </div>
      ) : null}

      <JustificacionEditor
        open={justif !== null}
        onOpenChange={(open) => {
          if (!open) setJustif(null);
        }}
        guardando={guardando.size > 0}
        titulo="Cambiar asistencia de un día anterior"
        descripcion={
          justif
            ? `De ${ESTADO_NOMBRE[estadoDe(justif.fila, justif.fecha) ?? "presente"]} a ${
                ESTADO_NOMBRE[justif.estado]
              } para ${justif.fila.estudiante} el ${formatoFecha(justif.fecha)}.`
            : undefined
        }
        onConfirmar={(texto) => {
          if (!justif) return;
          const { fila, fecha, estado } = justif;
          setJustif(null);
          void persistir(fila, fecha, estado, texto);
        }}
      />
    </>
  );
}
