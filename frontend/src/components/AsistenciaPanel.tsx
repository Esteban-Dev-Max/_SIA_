import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AsistenciaTab } from "@/components/AsistenciaTab";
import { HistorialAsistenciaTab } from "@/components/HistorialAsistenciaTab";

type VistaAsistencia = "toma" | "resumen";

export function AsistenciaPanel({ sel, grupoLabel }: { sel: number | null; grupoLabel?: string }) {
  const [vista, setVista] = useState<VistaAsistencia>("toma");
  // Bump para que el resumen se vuelva a cargar tras guardar la toma del día.
  const [version, setVersion] = useState(0);

  const refrescar = () => setVersion((v) => v + 1);

  function cambiarVista(v: string) {
    if (v === "toma" || v === "resumen") setVista(v);
  }

  return (
    <Tabs value={vista} onValueChange={cambiarVista} className="space-y-4">
      <TabsList className="w-fit rounded-xl bg-muted/40 p-1">
        <TabsTrigger
          value="toma"
          className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Tomar asistencia
        </TabsTrigger>
        <TabsTrigger
          value="resumen"
          className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Resumen y reportes
        </TabsTrigger>
      </TabsList>
      <TabsContent value="toma">
        <AsistenciaTab sel={sel} grupoLabel={grupoLabel} onGuardar={refrescar} />
      </TabsContent>
      <TabsContent value="resumen">
        <HistorialAsistenciaTab sel={sel} version={version} />
      </TabsContent>
    </Tabs>
  );
}
