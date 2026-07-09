import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";

export const Route = createFileRoute("/profesor")({
  beforeLoad: () => requireRole("profesor"),
  component: ProfesorPanel,
});

type Materia = { id: number; nombre: string };
type Alumno = {
  matricula_id: number;
  estudiante_id: number;
  nombre: string;
  email: string;
  parcial: number | null;
  medio: number | null;
  final: number | null;
};

function ProfesorPanel() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);

  useEffect(() => {
    api<Materia[]>("/api/profesor/materias").then((m) => {
      setMaterias(m);
      if (m[0]) setSel(m[0].id);
    });
  }, []);
  useEffect(() => {
    if (sel) api<Alumno[]>(`/api/profesor/materias/${sel}/alumnos`).then(setAlumnos);
  }, [sel]);

  async function saveNota(a: Alumno, campo: "parcial" | "medio" | "final", valor: string) {
    const num = valor === "" ? null : Number(valor);
    const nuevo = { ...a, [campo]: num };
    setAlumnos((prev) => prev.map((x) => (x.matricula_id === a.matricula_id ? nuevo : x)));
    await api(`/api/profesor/notas/${a.matricula_id}`, {
      method: "PUT",
      body: JSON.stringify({ parcial: nuevo.parcial, medio: nuevo.medio, final: nuevo.final }),
    });
  }

  async function marcarAsistencia(a: Alumno, presente: boolean) {
    const fecha = new Date().toISOString().slice(0, 10);
    await api("/api/profesor/asistencia", {
      method: "POST",
      body: JSON.stringify({ matricula_id: a.matricula_id, fecha, presente }),
    });
    alert(`Asistencia (${fecha}) registrada para ${a.nombre}: ${presente ? "Presente" : "Ausente"}`);
  }

  return (
    <PanelShell title="Panel Profesor">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium">Materia:</label>
        <select
          value={sel ?? ""}
          onChange={(e) => setSel(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left">Alumno</th>
              <th className="px-4 py-2 text-left">Parcial</th>
              <th className="px-4 py-2 text-left">Medio</th>
              <th className="px-4 py-2 text-left">Final</th>
              <th className="px-4 py-2 text-left">Asistencia hoy</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a) => (
              <tr key={a.matricula_id} className="border-t">
                <td className="px-4 py-2">
                  <div>{a.nombre}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </td>
                {(["parcial", "medio", "final"] as const).map((c) => (
                  <td key={c} className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={a[c] ?? ""}
                      onBlur={(e) => saveNota(a, c, e.target.value)}
                      className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => marcarAsistencia(a, true)}
                      className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                    >
                      Presente
                    </button>
                    <button
                      onClick={() => marcarAsistencia(a, false)}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      Ausente
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {alumnos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Sin alumnos matriculados en esta materia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}
