import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChatbotWidget } from "@/components/ChatbotWidget";
import { cn } from "@/lib/utils";
import { BookOpen, TrendingUp, Award, CalendarCheck, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/estudiante/")({
  component: EstudiantePanel,
});

type MateriaNota = {
  grupo_id: number;
  periodo: string;
  materia: string;
  materia_codigo: string;
  matricula_id: number;
  nota_1: number | null;
  nota_2: number | null;
  nota_3: number | null;
  examen_final: number | null;
  nota_definitiva: number | null;
  observaciones: string | null;
};

type AsistenciaMateria = {
  materia: string;
  presentes: number;
  ausentes: number;
  tardes: number;
  excusas: number;
  total: number;
  fallas: number;
  porcentaje: number | null;
};

type ResumenAsistencia = {
  total_registros: number;
  presentes: number;
  ausentes: number;
  tardes: number;
  excusas: number;
  porcentaje_asistencia: number;
  total_fallas: number;
  por_materia: AsistenciaMateria[];
};

function notaBadge(def: number | null) {
  if (def == null) {
    return (
      <Badge
        variant="outline"
        className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
      >
        —
      </Badge>
    );
  }
  const pasar = def >= 3;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        pasar
          ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
          : "border-rose-200 bg-rose-500/10 text-rose-700",
      )}
    >
      {pasar ? "Ganó" : "Perdió"} · {def.toFixed(2)}
    </Badge>
  );
}

function EstudiantePanel() {
  const userId = getUser()?.id;
  const [materias, setMaterias] = useState<MateriaNota[]>([]);
  const [resumen, setResumen] = useState<ResumenAsistencia | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setCargando(true);
    api<MateriaNota[]>(`/api/notas/estudiante/${userId}`)
      .then(setMaterias)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar calificaciones"),
      );
    api<ResumenAsistencia>(`/api/asistencia/resumen/estudiante/${userId}`)
      .then(setResumen)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar asistencia"),
      )
      .finally(() => setCargando(false));
  }, [userId]);

  const notasDefinitivas = materias
    .map((m) => m.nota_definitiva)
    .filter((n): n is number => n != null);
  const promedio = notasDefinitivas.length
    ? notasDefinitivas.reduce((s, n) => s + n, 0) / notasDefinitivas.length
    : 0;
  const aprobadas = notasDefinitivas.filter((n) => n >= 3).length;

  const asisPct = resumen?.porcentaje_asistencia ?? 0;
  const fallas = resumen?.total_fallas ?? 0;

  return (
    <>
      <ChatbotWidget />

      {/* Mis Calificaciones */}
      <section className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-violet-500/10">
            <Award className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold font-display">Mis calificaciones</h2>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Materias inscritas"
            value={materias.length}
            icon={BookOpen}
            accent="primary"
          />
          <StatCard
            label="Promedio general"
            value={promedio.toFixed(2)}
            icon={TrendingUp}
            accent={promedio >= 3 ? "emerald" : "rose"}
          />
          <StatCard
            label="Materias aprobadas"
            value={`${aprobadas}/${notasDefinitivas.length}`}
            icon={Award}
            accent={aprobadas >= 3 ? "emerald" : "amber"}
          />
        </div>

        <DataTable
          loading={cargando}
          headers={["Materia", "Periodo", "Nota 1", "Nota 2", "Nota 3", "Examen", "Definitiva"]}
          rows={materias.map((m) => [
            <span key="m" className="font-medium">
              {m.materia}
            </span>,
            <Badge key="p" variant="outline" className="text-xs font-normal rounded-full px-2.5">
              {m.periodo}
            </Badge>,
            m.nota_1 ?? (
              <span key="n1" className="text-muted-foreground">
                —
              </span>
            ),
            m.nota_2 ?? (
              <span key="n2" className="text-muted-foreground">
                —
              </span>
            ),
            m.nota_3 ?? (
              <span key="n3" className="text-muted-foreground">
                —
              </span>
            ),
            m.examen_final ?? (
              <span key="nf" className="text-muted-foreground">
                —
              </span>
            ),
            notaBadge(m.nota_definitiva),
          ])}
          emptyMessage="Aún no tienes materias matriculadas."
        />
      </section>

      {/* Mi Asistencia */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold font-display">Mi asistencia</h2>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Asistencia total"
            value={`${asisPct}%`}
            icon={CalendarCheck}
            accent={asisPct >= 80 ? "emerald" : asisPct >= 60 ? "amber" : "rose"}
          />
          <StatCard
            label="Fallas acumuladas"
            value={fallas}
            icon={AlertTriangle}
            accent={fallas === 0 ? "emerald" : fallas <= 3 ? "amber" : "rose"}
          />
          <StatCard
            label="Registros"
            value={resumen?.total_registros ?? 0}
            icon={Clock}
            accent="sky"
          />
        </div>

        <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumen por materia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-emerald-200 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              >
                {resumen?.presentes ?? 0} presentes
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-rose-200 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700"
              >
                {resumen?.ausentes ?? 0} ausentes
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-amber-200 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700"
              >
                {resumen?.tardes ?? 0} tardes
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-sky-200 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-700"
              >
                {resumen?.excusas ?? 0} excusas
              </Badge>
            </div>

            {resumen?.por_materia.length ? (
              resumen.por_materia.map((pm) => (
                <div key={pm.materia} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{pm.materia}</span>
                    <span className="text-muted-foreground">
                      {pm.porcentaje != null ? `${pm.porcentaje}% de asistencia` : "Sin registros"}
                      {pm.fallas > 0 && (
                        <span className="text-rose-600"> · {pm.fallas} fallas</span>
                      )}
                    </span>
                  </div>
                  <Progress
                    value={pm.porcentaje ?? 0}
                    className={cn(
                      "h-2",
                      pm.porcentaje != null && pm.porcentaje < 80 && "bg-rose-500/20",
                    )}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay registros de asistencia.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
