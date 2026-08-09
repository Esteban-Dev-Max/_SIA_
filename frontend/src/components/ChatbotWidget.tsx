import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, getUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bot, Send, Loader2, MessageCircle, Sparkles } from "lucide-react";

type Mensaje = { de: "bot" | "usuario"; texto: string; sugerida?: boolean };

const FAQ_INICIAL = [
  "¿Cómo veo mis notas?",
  "¿Cuándo debo entregar mi tarea?",
  "¿Cómo está mi promedio?",
  "¿Cómo reviso mi asistencia?",
];

function Bienvenida() {
  const user = getUser();
  const nombre = user?.nombre?.split(" ")[0];
  return `¡Hola${nombre ? ", " + nombre : ""}! Soy el Asistente SIA, tu guía de la plataforma. Pregúntame sobre notas, tareas, asistencia, reuniones, mensajes o calendario.`;
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && mensajes.length === 0) {
      setMensajes([{ de: "bot", texto: Bienvenida() }]);
    }
  }, [open, mensajes.length]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  async function preguntar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || cargando) return;
    setMensajes((prev) => [...prev, { de: "usuario", texto: limpio }]);
    setInput("");
    setCargando(true);
    try {
      const data = await api<{ respuesta: string; opciones?: string[] }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ pregunta: limpio }),
      });
      setMensajes((prev) => [
        ...prev,
        { de: "bot", texto: data.respuesta },
        ...(data.opciones?.length
          ? data.opciones.map((o) => ({ de: "bot" as const, texto: o, sugerida: true }))
          : []),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar al asistente");
      setMensajes((prev) => [
        ...prev,
        {
          de: "bot",
          texto: "Ups, tuve un problema para responder. Intenta de nuevo en un momento.",
        },
      ]);
    } finally {
      setCargando(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    preguntar(input);
  }

  return (
    <>
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 shadow-sm rounded-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-violet-500" />
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-md">
            <Bot className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight">Asistente SIA</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Sparkles className="h-3 w-3" />
                Chatbot de ayuda
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Resuelve tus dudas sobre notas, tareas, asistencia y más en tiempo real.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2 rounded-xl">
            <MessageCircle className="h-4 w-4" />
            Iniciar conversación
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[80vh] max-h-[720px] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 p-0 sm:max-w-lg">
          <DialogHeader className="flex-row items-center gap-3 border-b border-border/50 bg-gradient-to-r from-primary/10 to-violet-500/10 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base">Asistente SIA</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Chatbot de ayuda · en línea
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {mensajes.map((m, i) => {
              if (m.de === "bot" && m.sugerida) {
                return (
                  <div key={i} className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => preguntar(m.texto)}
                      className="max-w-[85%] rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      {m.texto}
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={cn("flex", m.de === "usuario" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.de === "usuario"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm border border-border/50 bg-muted/40",
                    )}
                  >
                    {m.texto}
                  </div>
                </div>
              );
            })}

            {cargando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border/50 bg-muted/40 px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Asistente SIA está escribiendo...
                  </span>
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {mensajes.length === 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {FAQ_INICIAL.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => preguntar(f)}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-border/50 p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              className="flex-1 rounded-xl border-border/60"
            />
            <Button
              type="submit"
              size="icon"
              disabled={cargando || !input.trim()}
              aria-label="Enviar"
              className="rounded-xl"
            >
              {cargando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
