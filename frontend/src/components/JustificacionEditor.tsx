import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Diálogo de justificación para ediciones de asistencia en días anteriores.
 * El backend rechaza (400) cambiarlas sin motivo, así que se pide antes de enviar.
 */
export function JustificacionEditor({
  open,
  onOpenChange,
  onConfirmar,
  titulo = "Editar asistencia de un día anterior",
  descripcion,
  guardando,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (texto: string) => void;
  titulo?: string;
  descripcion?: string;
  guardando?: boolean;
}) {
  const [texto, setTexto] = useState("");

  function confirmar() {
    onConfirmar(texto.trim());
    setTexto("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setTexto("");
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descripcion ?? "El cambio queda registrado en la bitácora de trazabilidad."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="justificacion-motivo" className="text-sm font-medium">
            Motivo de la edición <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="justificacion-motivo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            placeholder="Ej.: Registro omitido por error, reemplazo de clase, corrección de la planilla..."
            className="w-full min-h-[110px] resize-y rounded-xl"
            rows={4}
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-end sm:space-x-0">
          <Button
            variant="outline"
            onClick={() => {
              setTexto("");
              onOpenChange(false);
            }}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!texto.trim() || guardando}
            className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white sm:w-auto"
          >
            {guardando && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            <Save className="h-3.5 w-3.5" />
            Guardar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
