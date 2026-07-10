import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { PanelShell } from "@/components/PanelShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BookOpen, CheckCircle2, Inbox, XCircle } from "lucide-react";

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
    toast.success(
      `${a.nombre}: ${presente ? "Presente" : "Ausente"} (${fecha})`,
    );
  }

  const materiaActual = materias.find((m) => m.id === sel);

  return (
    <PanelShell title="Panel Profesor">
      {/* Subject Selector */}
      <Card className="mb-6 border-border/50 shadow-sm rounded-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            Seleccionar materia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="materia" className="sr-only">
              Materia
            </Label>
            <select
              id="materia"
              value={sel ?? ""}
              onChange={(e) => setSel(Number(e.target.value))}
              className="input-field max-w-sm"
            >
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            {materiaActual && (
              <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-xs font-medium">
                {alumnos.length} alumnos
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grades & Attendance Table */}
      <Card className="overflow-hidden border-border/50 shadow-sm rounded-xl">
        <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-muted/60 to-muted/30 hover:from-muted/60 hover:to-muted/30">
              <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alumno</TableHead>
              <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parcial</TableHead>
              <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medio</TableHead>
              <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Final</TableHead>
              <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asistencia hoy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alumnos.map((a, i) => (
              <TableRow key={a.matricula_id} className={cn("transition-colors hover:bg-muted/30", i % 2 === 0 ? "bg-white" : "bg-muted/10")}>
                <TableCell className="px-4 py-3">
                  <div className="font-medium">{a.nombre}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </TableCell>
                {(["parcial", "medio", "final"] as const).map((c) => (
                  <TableCell key={c} className="px-4 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={a[c] ?? ""}
                      onBlur={(e) => saveNota(a, c, e.target.value)}
                      className="w-20 h-9 rounded-lg border-border/60 text-center text-sm font-medium focus-visible:ring-primary/30"
                    />
                  </TableCell>
                ))}
                <TableCell className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => marcarAsistencia(a, true)}
                      className="gap-1 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Presente
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => marcarAsistencia(a, false)}
                      className="gap-1 h-8 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Ausente
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {alumnos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                      <Inbox className="h-6 w-6 opacity-40" />
                    </div>
                    <span className="text-sm font-medium">Sin alumnos matriculados en esta materia.</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </PanelShell>
  );
}
