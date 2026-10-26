import { useRef, useState } from "react";
import { AlertCircle, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_ENTREGA,
  TAMANO_MAX_ENTREGA_MB,
  formatearBytes,
  validarArchivoEntrega,
} from "@/lib/archivos";

type FileDropzoneProps = {
  archivo: File | null;
  onArchivo: (archivo: File | null) => void;
  disabled?: boolean;
  id?: string;
  /** Acepta los formatos de entrega (por defecto) o los que indique el padre. */
  accept?: string;
};

export function FileDropzone({
  archivo,
  onArchivo,
  disabled = false,
  id = "archivo",
  accept = ACCEPT_ENTREGA,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrirSelector() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function seleccionar(file: File | null | undefined) {
    if (!file || disabled) return;
    const mensaje = validarArchivoEntrega(file);
    if (mensaje) {
      setError(mensaje);
      onArchivo(null);
      return;
    }
    setError(null);
    onArchivo(file);
    // Permite volver a elegir el mismo archivo después de quitarlo.
    if (inputRef.current) inputRef.current.value = "";
  }

  function limpiar() {
    setError(null);
    onArchivo(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Seleccionar archivo de la entrega"
        aria-describedby={error ? `${id}-error` : undefined}
        aria-disabled={disabled}
        onClick={abrirSelector}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrirSelector();
          }
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setArrastrando(false);
          seleccionar(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          arrastrando
            ? "border-primary bg-primary/5"
            : "border-border/70 bg-muted/20 hover:border-primary/60 hover:bg-muted/40",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => seleccionar(e.target.files?.[0])}
        />
        {archivo ? (
          <>
            <span className="flex max-w-full items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{archivo.name}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {formatearBytes(archivo.size)} · haz clic para cambiarlo
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-1 h-7 gap-1 rounded-lg text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                limpiar();
              }}
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </Button>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Arrastra tu archivo aquí</span>
            <span className="text-xs text-muted-foreground">
              o haz clic para seleccionarlo · máx. {TAMANO_MAX_ENTREGA_MB} MB
            </span>
            <span className="text-[11px] text-muted-foreground">
              PDF, Word, PowerPoint, Excel, imágenes o ZIP
            </span>
          </>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs text-rose-600"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
