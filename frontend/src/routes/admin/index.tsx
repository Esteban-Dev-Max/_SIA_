import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  ClipboardList,
  School,
  HeartHandshake,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminPanel,
});

type Stats = {
  estudiantes: number;
  profesores: number;
  materias: number;
  grupos: number;
  matriculas: number;
  carreras: number;
  acudientes: number;
};

function AdminPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/api/admin/stats")
      .then(setStats)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Error al cargar estadísticas"),
      );
  }, []);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight">Resumen general</h2>
        <p className="text-sm text-muted-foreground">Métricas globales de la institución</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Estudiantes"
          value={stats?.estudiantes ?? "—"}
          icon={Users}
          accent="primary"
        />
        <StatCard
          label="Profesores"
          value={stats?.profesores ?? "—"}
          icon={GraduationCap}
          accent="emerald"
        />
        <StatCard
          label="Acudientes"
          value={stats?.acudientes ?? "—"}
          icon={HeartHandshake}
          accent="sky"
        />
        <StatCard label="Materias" value={stats?.materias ?? "—"} icon={BookOpen} accent="amber" />
        <StatCard label="Grupos" value={stats?.grupos ?? "—"} icon={Layers} accent="violet" />
        <StatCard
          label="Carreras / Grados"
          value={stats?.carreras ?? "—"}
          icon={School}
          accent="rose"
        />
        <StatCard
          label="Matrículas"
          value={stats?.matriculas ?? "—"}
          icon={ClipboardList}
          accent="primary"
        />
      </div>

      <Card className="mt-6 border-border/50 shadow-sm rounded-xl">
        <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground">
          Usa la navegación superior para administrar usuarios, el módulo académico (carreras,
          materias, grupos y matrículas) y las vinculaciones de acudientes.
        </CardContent>
      </Card>
    </>
  );
}
