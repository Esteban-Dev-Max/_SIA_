import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, getUser, type Rol } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { AuthGate } from "@/components/AuthGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MessageSquare,
  Send,
  Loader2,
  Inbox,
  Search,
  Users,
  GraduationCap,
  User,
  HeartHandshake,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/mensajes")({
  beforeLoad: () => requireRole("admin", "profesor", "estudiante", "acudiente"),
  component: MensajesView,
});

type Contacto = {
  contacto_id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  ultimo_mensaje: string | null;
  ultima_fecha: string | null;
  no_leidas: number;
};

type Mensaje = {
  id: number;
  remitente_id: number;
  destinatario_id: number;
  contenido: string;
  leido: boolean;
  fecha_envio: string;
};

const rolLabels: Record<Rol, string> = {
  admin: "Admin",
  profesor: "Docente",
  estudiante: "Estudiante",
  acudiente: "Acudiente",
};

const rolIcons: Record<Rol, typeof User> = {
  admin: Users,
  profesor: GraduationCap,
  estudiante: User,
  acudiente: HeartHandshake,
};

function fmtHora(fecha: string): string {
  try {
    return format(new Date(fecha), "HH:mm");
  } catch {
    return "";
  }
}

function fmtDia(fecha: string): string {
  try {
    return format(new Date(fecha), "d MMM", { locale: es });
  } catch {
    return "";
  }
}

function MensajesView() {
  const user = getUser();
  const userId = user?.id;
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [sel, setSel] = useState<Contacto | null>(null);
  const [hilo, setHilo] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [buscando, setBuscando] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [openNuevo, setOpenNuevo] = useState(false);
  const [busquedaContacto, setBusquedaContacto] = useState("");
  const [contactosPosibles, setContactosPosibles] = useState<Contacto[]>([]);
  const finRef = useRef<HTMLDivElement>(null);

  const loadConversaciones = useCallback(async () => {
    if (!userId) return;
    try {
      const convs = await api<Contacto[]>(`/api/mensajes/conversaciones/${userId}`);
      setContactos(convs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar conversaciones");
    }
  }, [userId]);

  useEffect(() => {
    loadConversaciones();
  }, [loadConversaciones]);

  // Busca usuarios para iniciar una conversación nueva.
  const genRef = useRef(0);
  const buscarContactos = useCallback(async () => {
    const gen = ++genRef.current;
    try {
      const url = `/api/mensajes/contactos${
        busquedaContacto.trim() ? `?q=${encodeURIComponent(busquedaContacto.trim())}` : ""
      }`;
      const data = await api<Contacto[]>(url);
      if (gen === genRef.current) setContactosPosibles(data);
    } catch (err) {
      if (gen === genRef.current)
        toast.error(err instanceof Error ? err.message : "Error al buscar contactos");
    }
  }, [busquedaContacto]);

  // Debounce de la búsqueda de contactos: espera 300 ms tras la última pulsación.
  useEffect(() => {
    if (!openNuevo) return;
    const t = setTimeout(buscarContactos, 300);
    return () => clearTimeout(t);
  }, [openNuevo, buscarContactos]);

  function iniciarConversacion(contacto: Contacto) {
    const existente = contactos.find((c) => c.contacto_id === contacto.contacto_id);
    setSel(existente ?? { ...contacto, ultimo_mensaje: null, ultima_fecha: null, no_leidas: 0 });
    setOpenNuevo(false);
    setBusquedaContacto("");
  }

  const loadHilo = useCallback(
    async (contacto: Contacto) => {
      if (!userId) return;
      setCargando(true);
      try {
        const msgs = await api<Mensaje[]>(
          `/api/mensajes/conversacion/${userId}/${contacto.contacto_id}`,
        );
        setHilo(msgs);
        await api(`/api/mensajes/leidas/${userId}/${contacto.contacto_id}`, { method: "PUT" });
        setContactos((prev) =>
          prev.map((c) => (c.contacto_id === contacto.contacto_id ? { ...c, no_leidas: 0 } : c)),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar la conversación");
      } finally {
        setCargando(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (sel) loadHilo(sel);
  }, [sel, loadHilo]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [hilo, cargando]);

  // Actualiza el hilo activo y los contactos cada 8s (chat casi en tiempo real).
  useEffect(() => {
    const t = setInterval(() => {
      if (sel) loadHilo(sel);
      loadConversaciones();
    }, 8000);
    return () => clearInterval(t);
  }, [sel, loadHilo, loadConversaciones]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || !sel || enviando) return;
    setEnviando(true);
    try {
      const data = await api<{ mensaje: Mensaje }>("/api/mensajes/enviar", {
        method: "POST",
        body: JSON.stringify({ destinatario_id: sel.contacto_id, contenido: texto }),
      });
      setHilo((prev) => [...prev, data.mensaje]);
      setInput("");
      loadConversaciones();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar mensaje");
    } finally {
      setEnviando(false);
    }
  }

  const contactosFiltrados = contactos.filter(
    (c) =>
      !buscando.trim() ||
      c.nombre.toLowerCase().includes(buscando.trim().toLowerCase()) ||
      c.correo.toLowerCase().includes(buscando.trim().toLowerCase()),
  );

  return (
    <AuthGate roles={["admin", "profesor", "estudiante", "acudiente"]}>
      <PanelShell title="Mensajería Interna">
        <div className="grid h-[calc(100vh-16rem)] min-h-[480px] grid-cols-1 gap-4 md:grid-cols-[20rem_1fr]">
          {/* Lista de conversaciones */}
          <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm rounded-xl">
            <div className="border-b border-border/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Conversaciones
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenNuevo(true)}
                  className="gap-1 rounded-lg h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscando}
                  onChange={(e) => setBuscando(e.target.value)}
                  placeholder="Buscar contacto..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {contactosFiltrados.length === 0 && (
                <div className="flex h-full flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                  <Inbox className="h-8 w-8 opacity-40" />
                  <span className="text-sm font-medium">Sin conversaciones aún</span>
                  <span className="text-xs">
                    Tus contactos aparecerán aquí cuando se escriban mensajes.
                  </span>
                </div>
              )}
              {contactosFiltrados.map((c) => {
                const Icon = rolIcons[c.rol] ?? User;
                return (
                  <button
                    key={c.contacto_id}
                    type="button"
                    onClick={() => setSel(c)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                      sel?.contacto_id === c.contacto_id ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        sel?.contacto_id === c.contacto_id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{c.nombre}</span>
                        {c.ultima_fecha && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {fmtDia(c.ultima_fecha)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">
                          {c.ultimo_mensaje ?? "Nueva conversación"}
                        </span>
                        {c.no_leidas > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {c.no_leidas}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Ventana de chat */}
          <Card className="flex flex-col overflow-hidden border-border/50 shadow-sm rounded-xl">
            {!sel ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <MessageSquare className="h-8 w-8 opacity-40" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Selecciona una conversación
                  </p>
                  <p className="text-xs">
                    Elige un contacto de la izquierda para empezar a chatear.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border/50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {(() => {
                      const Icon = rolIcons[sel.rol] ?? User;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{sel.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {sel.correo} ·{" "}
                      <Badge
                        variant="outline"
                        className="ml-0.5 rounded-full px-1.5 text-[10px] font-normal"
                      >
                        {rolLabels[sel.rol]}
                      </Badge>
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {cargando && hilo.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : hilo.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                      <MessageSquare className="h-8 w-8 opacity-40" />
                      <span className="text-sm font-medium">Sin mensajes aún</span>
                      <span className="text-xs">
                        Escribe el primer mensaje para iniciar la conversación.
                      </span>
                    </div>
                  ) : (
                    hilo.map((m) => {
                      const propio = m.remitente_id === userId;
                      return (
                        <div
                          key={m.id}
                          className={cn("flex", propio ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                              propio
                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                : "rounded-bl-sm border border-border/50 bg-muted/40",
                            )}
                          >
                            <p className="whitespace-pre-line">{m.contenido}</p>
                            <p
                              className={cn(
                                "mt-1 text-[10px]",
                                propio ? "text-primary-foreground/70" : "text-muted-foreground",
                              )}
                            >
                              {fmtHora(m.fecha_envio)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={finRef} />
                </div>

                <form
                  onSubmit={enviar}
                  className="flex items-center gap-2 border-t border-border/50 p-3"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Mensaje para ${sel.nombre.split(" ")[0]}...`}
                    className="flex-1 rounded-xl border-border/60"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={enviando || !input.trim()}
                    aria-label="Enviar"
                    className="rounded-xl"
                  >
                    {enviando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>

        {/* Búsqueda de contacto para iniciar conversación */}
        <Dialog open={openNuevo} onOpenChange={setOpenNuevo}>
          <DialogContent className="rounded-2xl border-border/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Nueva conversación
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={busquedaContacto}
                onChange={(e) => setBusquedaContacto(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="pl-9"
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {contactosPosibles.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No se encontraron usuarios.
                </p>
              )}
              {contactosPosibles.map((c) => {
                const Icon = rolIcons[c.rol] ?? User;
                return (
                  <button
                    key={c.contacto_id}
                    type="button"
                    onClick={() => iniciarConversacion(c)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.correo}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full px-2 text-[10px] font-normal"
                    >
                      {rolLabels[c.rol]}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </PanelShell>
    </AuthGate>
  );
}
