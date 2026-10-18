import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Cpu,
  Keyboard,
  Loader2,
  QrCode,
  Square,
  UserCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ID_VIDEO = "sia-scanner-camara";

type RegistroReciente = {
  id: number;
  estudiante: string;
  hora: string;
  exito: boolean;
  detalle: string;
};

/**
 * Registro por carné (QR o lector USB). La marca siempre es "presente" del día
 * seleccionado; el backend estampa quién marcó y cuándo. Pensado para tablet/
 * lector en el salón, estilo Nargar.
 */
export function EscaneoAsistencia({
  grupoId,
  fecha,
  onMarcado,
}: {
  grupoId: number;
  fecha: string;
  onMarcado?: () => void;
}) {
  const [modo, setModo] = useState<"camara" | "usb">("camara");
  const [encendida, setEncendida] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [recientes, setRecientes] = useState<RegistroReciente[]>([]);
  const [codigoManual, setCodigoManual] = useState("");
  const qrRef = useRef<Html5Qrcode | null>(null);
  const contador = useRef(0);

  async function marcar(codigo: string) {
    const carne = codigo.trim();
    if (!carne || !grupoId || marcando) return;
    setMarcando(true);
    const id = ++contador.current;
    try {
      const d = await api<{ ok: boolean; estudiante: string }>("/api/asistencia/escaneo", {
        method: "POST",
        body: JSON.stringify({ grupo_id: grupoId, fecha, codigo_carnet: carne }),
      });
      const ahora = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      setRecientes((prev) =>
        [
          { id, estudiante: d.estudiante, hora: ahora, exito: true, detalle: "Marcado presente" },
          ...prev,
        ].slice(0, 10),
      );
      toast.success(`${d.estudiante} marcado presente`);
      onMarcado?.();
      // Pausa el escaneo un instante para evitar lecturas repetidas del mismo QR.
      if (qrRef.current) {
        try {
          qrRef.current.pause(true);
          setTimeout(() => qrRef.current?.resume(), 1200);
        } catch {
          // ignora; el escaneo continúa
        }
      }
    } catch (err) {
      setRecientes((prev) =>
        [
          {
            id,
            estudiante: carne,
            hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
            exito: false,
            detalle: err instanceof Error ? err.message : "No se pudo registrar",
          },
          ...prev,
        ].slice(0, 10),
      );
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el carné");
    } finally {
      setMarcando(false);
      setCodigoManual("");
    }
  }

  async function iniciar() {
    if (!grupoId || iniciando) return;
    setIniciando(true);
    try {
      const qr = new Html5Qrcode(ID_VIDEO);
      qrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (vw, vh) => {
            const lado = Math.max(160, Math.min(vw, vh) * 0.72);
            return { width: lado, height: lado };
          },
        },
        (texto) => void marcar(texto),
        undefined,
      );
      setEncendida(true);
    } catch {
      setEncendida(false);
      toast.error(
        "No se pudo iniciar la cámara. Verifica los permisos del navegador o usa el lector USB.",
      );
    } finally {
      setIniciando(false);
    }
  }

  async function detener() {
    const qr = qrRef.current;
    if (qr) {
      try {
        await qr.stop();
      } catch {
        // cámara ya detenida
      }
      try {
        qr.clear();
      } catch {
        // sin vista previa
      }
      qrRef.current = null;
    }
    setEncendida(false);
  }

  useEffect(() => {
    return () => {
      void detener();
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              Modo escáner de carné
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setModo("camara");
                  void detener();
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  modo === "camara"
                    ? "bg-background text-emerald-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Camera className="h-3.5 w-3.5" />
                Cámara
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo("usb");
                  void detener();
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  modo === "usb"
                    ? "bg-background text-emerald-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Lector USB
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {modo === "camara" ? (
            <div className="relative mx-auto max-w-xl overflow-hidden rounded-xl border border-border/60 bg-black/90">
              <div
                id={ID_VIDEO}
                className="h-[320px] [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
              />
              {(iniciando || (!encendida && !iniciando)) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white">
                  {iniciando ? (
                    <>
                      <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
                      <span className="text-sm font-medium">Iniciando cámara...</span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                        <Camera className="h-7 w-7 text-white/80" />
                      </div>
                      <span className="max-w-xs px-4 text-sm text-white/80">
                        Apunta al carné QR del estudiante. La marca de presentación se guarda al
                        instante en {fecha}.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Escanea con el lector: apunta y presiona Enter (o pega el código)
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void marcar(codigoManual);
                  }}
                  placeholder="Código del carné..."
                  autoFocus
                  className="h-10 rounded-lg border-border/60 font-mono text-sm"
                />
                <Button
                  onClick={() => void marcar(codigoManual)}
                  disabled={!codigoManual.trim() || marcando}
                  className="h-10 gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {marcando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  Registrar
                </Button>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-xl">
            {modo === "camara" &&
              (encendida ? (
                <Button
                  variant="outline"
                  onClick={() => void detener()}
                  className="w-full gap-1.5 rounded-lg border-border/60"
                >
                  <Square className="h-4 w-4" />
                  Detener cámara
                </Button>
              ) : (
                <Button
                  onClick={() => void iniciar()}
                  disabled={iniciando}
                  className="w-full gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {iniciando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  Iniciar cámara
                </Button>
              ))}
          </div>

          <div className="mx-auto max-w-xl">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marcados recientes ({fecha})
            </Label>
            {recientes.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                Aún no hay marcas en esta sesión de escaneo.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
                {recientes.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2 bg-card">
                    {r.exito ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {r.estudiante}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.hora}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.exito
                          ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                          : "border-rose-200 bg-rose-500/10 text-rose-700",
                      )}
                    >
                      {r.exito ? "Presente" : "Rechazado"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
