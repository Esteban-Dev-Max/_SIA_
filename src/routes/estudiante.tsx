import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";

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

  return (
    <PanelShell title="Panel Estudiante">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label="Materias" value={notas.length} />
        <Card label="Promedio general" value={prom.toFixed(2)} />
        <Card
          label="Asistencia"
          value={`${asis.filter((a) => a.presente).length}/${asis.length}`}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Notas por materia</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left">Materia</th>
                <th className="px-4 py-2 text-left">Periodo</th>
                <th className="px-4 py-2 text-left">Parcial</th>
                <th className="px-4 py-2 text-left">Medio</th>
                <th className="px-4 py-2 text-left">Final</th>
                <th className="px-4 py-2 text-left">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.matricula_id} className="border-t">
                  <td className="px-4 py-2">{n.materia}</td>
                  <td className="px-4 py-2">{n.periodo}</td>
                  <td className="px-4 py-2">{n.parcial ?? "—"}</td>
                  <td className="px-4 py-2">{n.medio ?? "—"}</td>
                  <td className="px-4 py-2">{n.final ?? "—"}</td>
                  <td className="px-4 py-2 font-medium">{n.promedio ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Historial de asistencia</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Materia</th>
                <th className="px-4 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {asis.map((a, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">{new Date(a.fecha).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{a.materia}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        a.presente
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {a.presente ? "Presente" : "Ausente"}
                    </span>
                  </td>
                </tr>
              ))}
              {asis.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PanelShell>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}
