import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BookOpen, TrendingUp, CalendarCheck, GraduationCap, Award, Clock } from "lucide-react";

export const Route = createFileRoute("/estudiante")({
  beforeLoad: () => requireRole("estudiante"),
  component: EstudiantePanel,
});

type NotaRow = {
  matricula_id: number;
  materia: string;
  periodo: string;
  parcial: number | null;
  medio: number | null;
  final: number | null;
  promedio: number | null;
};
type Asistencia = { fecha: string; presente: number; materia: string };

function EstudiantePanel() {
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [prom, setProm] = useState(0);
  const [asis, setAsis] = useState<Asistencia[]>([]);

  useEffect(() => {
    api<{ materias: NotaRow[]; promedio_general: number }>("/api/estudiante/notas").then((d) => {
      setNotas(d.materias);
      setProm(d.promedio_general);
    });
    api<Asistencia[]>("/api/estudiante/asistencia").then(setAsis);
  }, []);

  const asistPct =
    asis.length > 0
      ? Math.round((asis.filter((a) => a.presente).length / asis.length) * 100)
      : 0;

  const presentes = asis.filter((a) => a.presente).length;

  return (
    <PanelShell title="Panel Estudiante">
      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Materias inscritas"
          value={notas.length}
          icon={BookOpen}
          accent="primary"
          trend={notas.length > 0 ? { value: 100, isUp: true } : undefined}
        />
        <StatCard
          label="Promedio general"
          value={prom.toFixed(2)}
          icon={TrendingUp}
          accent={prom >= 3 ? "emerald" : "rose"}
          trend={prom > 0 ? { value: Math.round(prom * 20), isUp: prom >= 3 } : undefined}
        />
        <StatCard
          label="Asistencia"
          value={`${presentes}/${asis.length}`}
          icon={CalendarCheck}
          accent={asistPct >= 80 ? "emerald" : asistPct >= 60 ? "amber" : "rose"}
          trend={asis.length > 0 ? { value: asistPct, isUp: asistPct >= 80 } : undefined}
        />
      </div>

      {/* Grades Section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-violet-500/10">
            <Award className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold font-display">Notas por materia</h2>
        </div>
        <DataTable
          headers={["Materia", "Periodo", "Parcial", "Medio", "Final", "Promedio"]}
          rows={notas.map((n) => [
            <span key="m" className="font-medium">{n.materia}</span>,
            <Badge key="p" variant="outline" className="text-xs font-normal rounded-full px-2.5">
              {n.periodo}
            </Badge>,
            n.parcial ?? <span key="np" className="text-muted-foreground">—</span>,
            n.medio ?? <span key="nm" className="text-muted-foreground">—</span>,
            n.final ?? <span key="nf" className="text-muted-foreground">—</span>,
            <span key="pr" className={cn(
              "font-semibold",
              (n.promedio ?? 0) >= 3 ? "text-emerald-600" : (n.promedio ?? 0) >= 2 ? "text-amber-600" : "text-rose-600"
            )}>
              {n.promedio != null ? Number(n.promedio).toFixed(2) : "—"}
            </span>,
          ])}
          emptyMessage="Aún no tienes materias matriculadas."
        />
      </section>

      {/* Attendance Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold font-display">Historial de asistencia</h2>
        </div>
        <DataTable
          headers={["Fecha", "Materia", "Estado"]}
          rows={asis.map((a, i) => [
            <span key="f" className="text-muted-foreground">
              {new Date(a.fecha).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>,
            <span key="m" className="font-medium">{a.materia}</span>,
            a.presente ? (
              <Badge
                key={i}
                className="rounded-full border-emerald-200 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              >
                Presente
              </Badge>
            ) : (
              <Badge
                key={i}
                variant="destructive"
                className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 border-rose-200"
              >
                Ausente
              </Badge>
            ),
          ])}
          emptyMessage="Sin registros de asistencia."
        />
      </section>
    </PanelShell>
  );
}
