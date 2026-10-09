// Umbrales compartidos con backend/lib/asistencia.js: si cambias uno, cambia el otro.
export const UMBRAL_RIESGO = 80;
export const UMBRAL_ALERTA = 90;
export const UMBRAL_FALLAS_CRITICAS = 3;

export type EstadoAsistencia = "presente" | "ausente" | "tarde" | "excusa";

export type NivelRiesgo = "bajo" | "alerta" | "critico" | "sin_registros";

export type RegistroResumen = {
  fecha: string;
  estado: EstadoAsistencia;
  observacion: string | null;
  // Trazabilidad: última edición registrada en la bitácora (si hubo cambios).
  modificado_por?: string;
  fecha_modificacion?: string;
  justificacion?: string | null;
};

export type FilaResumen = {
  estudiante_id: number;
  matricula_id: number;
  estudiante: string;
  correo: string;
  foto_url: string | null;
  presentes: number;
  ausentes: number;
  tardes: number;
  excusas: number;
  total: number;
  fallas: number;
  porcentaje: number | null;
  en_riesgo: boolean;
  fallas_criticas: boolean;
  nivel: NivelRiesgo;
  registros: RegistroResumen[];
};

export type GrupoResumen = {
  id: number;
  codigo_grupo: string;
  periodo: string | null;
  horario: string | null;
  materia: string;
  materia_codigo: string | null;
  institucion_nombre: string;
  institucion_logo: string | null;
};

export type ResumenGrupo = {
  grupo: GrupoResumen;
  estudiantes: FilaResumen[];
  totales: {
    presentes: number;
    ausentes: number;
    tardes: number;
    excusas: number;
    total: number;
    fallas: number;
    porcentaje_general: number | null;
    en_riesgo: number;
    fallas_criticas: number;
    niveles: Record<NivelRiesgo, number>;
  };
  desde: string | null;
  hasta: string | null;
};

export type FiltroRiesgo =
  "todos" | "riesgo" | "criticas" | "bajo" | "alerta" | "critico" | "sin_registros";

// Semáforo de riesgo por fila (mismo criterio que backend/lib/asistencia.js).
export function nivelRiesgo(f: Pick<FilaResumen, "porcentaje" | "fallas_criticas">): NivelRiesgo {
  if (f.porcentaje == null) return "sin_registros";
  if (f.porcentaje < UMBRAL_RIESGO || f.fallas_criticas) return "critico";
  if (f.porcentaje < UMBRAL_ALERTA) return "alerta";
  return "bajo";
}

export const NIVEL_LABEL: Record<NivelRiesgo, string> = {
  bajo: "Bajo riesgo",
  alerta: "En alerta",
  critico: "Riesgo crítico",
  sin_registros: "Sin registros",
};

export const NIVEL_BADGE: Record<NivelRiesgo, string> = {
  bajo: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  alerta: "border-amber-200 bg-amber-500/10 text-amber-700",
  critico: "border-rose-200 bg-rose-500/10 text-rose-700",
  sin_registros: "border-border bg-muted text-muted-foreground",
};

export const NIVEL_DOT: Record<NivelRiesgo, string> = {
  bajo: "bg-emerald-500",
  alerta: "bg-amber-500",
  critico: "bg-rose-500",
  sin_registros: "bg-muted-foreground/40",
};

// Filtro de sesgo por riesgo, igual criterio que los flags del backend.
export function aplicarFiltro(filas: FilaResumen[], filtro: FiltroRiesgo): FilaResumen[] {
  if (filtro === "riesgo") return filas.filter((f) => f.en_riesgo);
  if (filtro === "criticas") return filas.filter((f) => f.fallas_criticas);
  if (
    filtro === "bajo" ||
    filtro === "alerta" ||
    filtro === "critico" ||
    filtro === "sin_registros"
  ) {
    return filas.filter((f) => f.nivel === filtro);
  }
  return filas;
}

// Columnas de la matriz: fechas de clase ordenadas dentro del rango consultado.
export function columnasFecha(filas: FilaResumen[]): string[] {
  const fechas = new Set<string>();
  for (const f of filas) for (const r of f.registros) fechas.add(r.fecha);
  return [...fechas].sort();
}

export function estadoDe(fila: FilaResumen, fecha: string): EstadoAsistencia | null {
  const reg = fila.registros.find((r) => r.fecha === fecha);
  return reg?.estado ?? null;
}

export function observacionDe(fila: FilaResumen, fecha: string): string | null {
  const reg = fila.registros.find((r) => r.fecha === fecha);
  return reg?.observacion ?? null;
}

export const ORDEN_ESTADOS: EstadoAsistencia[] = ["presente", "ausente", "tarde", "excusa"];

// Ciclo de un clic en la matriz: vacío → P → A → T → E → P.
export function cicloEstado(actual: EstadoAsistencia | null): EstadoAsistencia {
  if (!actual) return "presente";
  const i = ORDEN_ESTADOS.indexOf(actual);
  return ORDEN_ESTADOS[(i + 1) % ORDEN_ESTADOS.length];
}

export const ESTADO_LETRA: Record<EstadoAsistencia, string> = {
  presente: "P",
  ausente: "A",
  tarde: "T",
  excusa: "E",
};

export const ESTADO_NOMBRE: Record<EstadoAsistencia, string> = {
  presente: "Presente",
  ausente: "Ausente",
  tarde: "Llegada tarde",
  excusa: "Excusa",
};

// Formato corto dd/mm para encabezados de la matriz.
export function formatoFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

// Fecha local de hoy en formato ISO (YYYY-MM-DD).
export function hoyLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

// True si la fecha (ISO) es anterior a hoy: editar esas marcas exige justificación.
export function esFechaPasada(iso: string): boolean {
  return iso < hoyLocal();
}

export const ORDEN_COLUMNAS: (keyof FilaResumen)[] = ["presentes", "ausentes", "tardes", "excusas"];
