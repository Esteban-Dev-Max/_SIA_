import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import QRCode from "qrcode";
import { GraduationCap, Loader2, Printer, QrCode, X } from "lucide-react";
import { api, urlRecurso } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EstadoAsistencia } from "@/lib/asistencia";

type CarnetEstudiante = {
  matricula_id: number;
  estudiante_id: number;
  estudiante: string;
  correo: string;
  foto_url: string | null;
  codigo_carnet: string | null;
  estado: EstadoAsistencia | null;
};

const ESTILO_QR: Record<string, string> = {
  presente: "border-emerald-300 bg-emerald-500/10",
  ausente: "border-rose-300 bg-rose-500/10",
  tarde: "border-amber-300 bg-amber-500/10",
  excusa: "border-sky-300 bg-sky-500/10",
};

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Carnés QR imprimibles de un grupo. Se renderiza en un portal sobre el body
 * para que el CSS @media print (visibility) aísle solo el área de carnés.
 */
export function CarnetsAsistencia({
  grupoId,
  grupoLabel,
  fecha,
  onClose,
}: {
  grupoId: number;
  grupoLabel: string;
  fecha: string;
  onClose: () => void;
}) {
  const [carnets, setCarnets] = useState<(CarnetEstudiante & { codigo: string })[]>([]);
  const [qrData, setQrData] = useState<Map<number, string>>(new Map());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    api<{ registros: CarnetEstudiante[] }>(`/api/asistencia/grupo/${grupoId}?fecha=${fecha}`)
      .then(async (d) => {
        if (!activo) return;
        const listos = d.registros
          .filter((r) => r.codigo_carnet)
          .map((r) => ({ ...r, codigo: r.codigo_carnet as string }));
        const mapa = new Map<number, string>();
        await Promise.all(
          listos.map((c) =>
            QRCode.toDataURL(c.codigo, { width: 260, margin: 1, errorCorrectionLevel: "M" })
              .then((url) => mapa.set(c.matricula_id, url))
              .catch(() => undefined),
          ),
        );
        if (activo) {
          setCarnets(listos);
          setQrData(mapa);
        }
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "Error al cargar carnés");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [grupoId, fecha]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #sia-carnets, #sia-carnets * { visibility: visible; }
          #sia-carnets { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
          #sia-carnets .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <QrCode className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5">Carnés QR · {grupoLabel}</p>
            <p className="text-xs text-muted-foreground">
              Recorta y entrega uno a cada estudiante · {fecha}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!cargando && carnets.length > 0 && (
            <Button
              size="sm"
              className="gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Imprimir carnés
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg" onClick={onClose}>
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {cargando ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Generando carnés...</span>
        </div>
      ) : carnets.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <QrCode className="h-8 w-8 opacity-40" />
          <span className="max-w-xs text-sm font-medium">
            Ningún estudiante del grupo tiene carné asignado todavía. Contacta a la administración.
          </span>
        </div>
      ) : (
        <div id="sia-carnets" className="px-4 py-4">
          <div className="text-muted-foreground no-print text-xs">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              El borde de color indica la marca del día ({fecha}).
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {carnets.map((c) => {
              const url = qrData.get(c.matricula_id);
              return (
                <div
                  key={c.matricula_id}
                  className={cn(
                    "flex flex-col items-center gap-2 overflow-hidden rounded-xl border p-4 text-center",
                    c.estado ? ESTILO_QR[c.estado] : "border-border/60 bg-card",
                  )}
                >
                  <Avatar className="h-10 w-10 border border-border/60">
                    {c.foto_url ? (
                      <AvatarImage src={urlRecurso(c.foto_url)} alt={c.estudiante} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-700 text-xs font-semibold">
                      {iniciales(c.estudiante)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold leading-5">{c.estudiante}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{c.correo}</p>
                  </div>
                  {url ? (
                    <img
                      src={url}
                      alt={`QR de ${c.estudiante}`}
                      className="h-28 w-28 rounded-lg bg-white p-1"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                      QR no generado
                    </div>
                  )}
                  <Badge
                    variant="outline"
                    className="max-w-full rounded-full bg-background px-2 py-0.5 font-mono text-[10px] text-foreground"
                  >
                    {c.codigo}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
