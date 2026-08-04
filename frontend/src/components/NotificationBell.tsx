import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, getUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  BellRing,
  Inbox,
  GraduationCap,
  ClipboardList,
  MessageSquare,
  CalendarDays,
  Info,
  CheckCheck,
} from "lucide-react";

type Notificacion = {
  id: number;
  titulo: string;
  mensaje: string | null;
  tipo: "sistema" | "nota" | "tarea" | "mensaje" | "evento";
  leida: boolean;
  fecha_creacion: string;
};

const tipoIcon: Record<Notificacion["tipo"], typeof Info> = {
  sistema: Info,
  nota: GraduationCap,
  tarea: ClipboardList,
  mensaje: MessageSquare,
  evento: CalendarDays,
};

function tiempoRelativo(fecha: string): string {
  try {
    return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const user = getUser();
  const [notis, setNotis] = useState<Notificacion[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [abierto, setAbierto] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api<{ pendientes: number; notificaciones: Notificacion[] }>(
        `/api/notificaciones/${user.id}`,
      );
      setPendientes(data.pendientes);
      setNotis(data.notificaciones);
    } catch {
      /* silencioso: la cabecera no debe fallar por el estado de alertas */
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresca el contador al abrir el menú y cada 60s.
  useEffect(() => {
    if (!abierto) return;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [abierto, load]);

  async function marcarLeida(n: Notificacion) {
    if (n.leida) return;
    try {
      await api(`/api/notificaciones/marcar-leida/${n.id}`, { method: "PUT" });
      setNotis((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      setPendientes((p) => Math.max(0, p - 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function marcarTodas() {
    if (!user || pendientes === 0) return;
    try {
      await api(`/api/notificaciones/marcar-todas/${user.id}`, { method: "PUT" });
      setNotis((prev) => prev.map((x) => ({ ...x, leida: true })));
      setPendientes(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <DropdownMenu onOpenChange={setAbierto}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          className="relative h-10 w-10 rounded-xl hover:bg-accent/50"
        >
          {pendientes > 0 ? (
            <BellRing className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {pendientes > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {pendientes > 99 ? "99+" : pendientes}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-xl border-border/60 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-semibold">Notificaciones</span>
          {pendientes > 0 && (
            <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs font-medium">
              {pendientes} sin leer
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {notis.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              <span className="text-sm font-medium">No tienes notificaciones</span>
            </div>
          )}
          {notis.map((n) => {
            const Icon = tipoIcon[n.tipo] ?? Info;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => marcarLeida(n)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  n.leida ? "opacity-70 hover:bg-muted/40" : "bg-primary/5 hover:bg-primary/10",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    n.leida ? "bg-muted/60 text-muted-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{n.titulo}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {tiempoRelativo(n.fecha_creacion)}
                    </span>
                  </div>
                  {n.mensaje && (
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{n.mensaje}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {notis.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-border/50" />
            <button
              type="button"
              onClick={marcarTodas}
              disabled={pendientes === 0}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como leídas
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
