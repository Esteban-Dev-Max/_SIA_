import { useState } from "react";
import { createPortal } from "react-dom";
import { urlRecurso } from "@/lib/api";
import { cn } from "@/lib/utils";

export type BoletinNota = {
  grupo_id: number;
  periodo: string;
  horario: string | null;
  materia: string;
  materia_codigo: string | null;
  profesor: string | null;
  nota_1: number | null;
  nota_2: number | null;
  nota_3: number | null;
  examen_final: number | null;
  nota_definitiva: number | null;
  observaciones: string | null;
};

export type BoletinAsistencia = {
  fecha: string;
  estado: "presente" | "ausente" | "tarde" | "excusa";
  observacion: string | null;
  materia: string;
  periodo: string;
};

export type BoletinCurso = {
  nombre: string;
  grado: string;
  ano_lectivo: number;
  director: string | null;
};

export type BoletinInstitucion = {
  nombre: string;
  correo: string | null;
  telefono: string | null;
  departamento: string | null;
  ciudad: string | null;
  logo_url: string | null;
};

type BoletinProps = {
  estudiante: { id: number; nombre: string; correo: string; foto_url: string | null };
  curso: BoletinCurso | null;
  institucion: BoletinInstitucion | null;
  notas: BoletinNota[];
  asistencia: BoletinAsistencia[];
  periodo: string;
  acudiente: string;
};

const ESCALA = [
  { min: 4.6, label: "Superior", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  { min: 4.0, label: "Alto", className: "border-sky-300 bg-sky-50 text-sky-800" },
  { min: 3.0, label: "Básico", className: "border-amber-300 bg-amber-50 text-amber-800" },
  { min: -Infinity, label: "Bajo", className: "border-rose-300 bg-rose-50 text-rose-800" },
];

function desempeno(def: number | null) {
  if (def == null) {
    return { label: "Sin evaluar", className: "border-slate-300 bg-slate-50 text-slate-500" };
  }
  return ESCALA.find((e) => def >= e.min) ?? ESCALA[ESCALA.length - 1];
}

function fmtNota(n: number | null): string {
  return n == null ? "—" : Number(n).toFixed(2);
}

function formatPeriodo(p: string): string {
  const m = /^(\d{4})-P(\d)$/.exec(p);
  return m ? `Periodo ${m[2]} · ${m[1]}` : p;
}

function DocumentoBoletin({
  estudiante,
  curso,
  institucion,
  notas,
  asistencia,
  periodo,
  acudiente,
  observaciones,
  onObservaciones,
  imprimible,
}: BoletinProps & {
  observaciones: string;
  onObservaciones?: (v: string) => void;
  imprimible: boolean;
}) {
  const notasPeriodo = notas.filter((n) => n.periodo === periodo);
  const conDefinitiva = notasPeriodo.filter((n) => n.nota_definitiva != null);
  const promedio =
    conDefinitiva.length > 0
      ? conDefinitiva.reduce((acc, n) => acc + Number(n.nota_definitiva), 0) / conDefinitiva.length
      : null;

  const asistenciaPeriodo = asistencia.filter((a) => a.periodo === periodo);
  const faltas = asistenciaPeriodo.filter((a) => a.estado === "ausente").length;
  const retardos = asistenciaPeriodo.filter((a) => a.estado === "tarde").length;
  const excusas = asistenciaPeriodo.filter((a) => a.estado === "excusa").length;
  const presentes = asistenciaPeriodo.filter((a) => a.estado === "presente").length;

  const cursoLabel = curso ? `${curso.grado} ${curso.nombre}`.trim() : "—";
  const director = curso?.director ?? null;
  const contacto = [
    [institucion?.ciudad, institucion?.departamento].filter(Boolean).join(", "),
    institucion?.telefono ? `Tel. ${institucion.telefono}` : null,
    institucion?.correo,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "bg-white text-slate-900",
        imprimible ? "p-0" : "rounded-xl border border-slate-200 p-6 shadow-sm sm:p-8",
      )}
    >
      {/* Encabezado institucional */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {institucion?.logo_url ? (
            <img
              src={urlRecurso(institucion.logo_url)}
              alt={institucion.nombre}
              className="h-16 w-16 shrink-0 object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold text-slate-500">
              SIA
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">
              {institucion?.nombre ?? "Institución educativa"}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Sistema Integral Académico · SIA
            </p>
            {contacto && <p className="mt-1 text-[11px] text-slate-500">{contacto}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold uppercase tracking-wide">Boletín de calificaciones</p>
          <p className="text-xs text-slate-500">{formatPeriodo(periodo)}</p>
          {curso && <p className="text-xs text-slate-500">Año lectivo {curso.ano_lectivo}</p>}
        </div>
      </header>

      {/* Datos del estudiante */}
      <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border border-slate-300 p-4 text-sm sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Estudiante
          </p>
          <p className="font-semibold">{estudiante.nombre}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Grado / Ficha
          </p>
          <p className="font-medium">{cursoLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Periodo académico
          </p>
          <p className="font-medium">{formatPeriodo(periodo)}</p>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Acudiente a cargo
          </p>
          <p className="font-medium">{acudiente || "—"}</p>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Director(a) de grupo
          </p>
          <p className="font-medium">{director ?? "—"}</p>
        </div>
      </section>

      {/* Notas por asignatura */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-left text-[10px] uppercase tracking-wider text-slate-600">
            <th className="border border-slate-300 px-2.5 py-2 font-semibold">Asignatura</th>
            <th className="border border-slate-300 px-2.5 py-2 font-semibold">Docente</th>
            <th className="border border-slate-300 px-2.5 py-2 text-center font-semibold">
              Definitiva
            </th>
            <th className="border border-slate-300 px-2.5 py-2 font-semibold">Desempeño</th>
            <th className="border border-slate-300 px-2.5 py-2 font-semibold">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {notasPeriodo.map((n) => {
            const d = desempeno(n.nota_definitiva);
            return (
              <tr key={`${n.grupo_id}-${n.periodo}`} className="align-top">
                <td className="border border-slate-300 px-2.5 py-2">
                  <p className="font-medium">{n.materia}</p>
                  <p className="text-[10px] text-slate-500">
                    {[n.materia_codigo, n.horario].filter(Boolean).join(" · ") || "—"}
                  </p>
                </td>
                <td className="border border-slate-300 px-2.5 py-2">{n.profesor ?? "—"}</td>
                <td className="border border-slate-300 px-2.5 py-2 text-center font-mono font-semibold tabular-nums">
                  {fmtNota(n.nota_definitiva)}
                </td>
                <td className="border border-slate-300 px-2.5 py-2">
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      d.className,
                    )}
                  >
                    {d.label}
                  </span>
                </td>
                <td className="border border-slate-300 px-2.5 py-2 text-[12px] text-slate-600">
                  {n.observaciones ?? "—"}
                </td>
              </tr>
            );
          })}
          {notasPeriodo.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="border border-slate-300 px-3 py-8 text-center text-slate-500"
              >
                No hay asignaturas registradas para este periodo.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-300 px-2.5 py-2" colSpan={2}>
              Promedio general del periodo
            </td>
            <td className="border border-slate-300 px-2.5 py-2 text-center font-mono tabular-nums">
              {promedio != null ? promedio.toFixed(2) : "—"}
            </td>
            <td className="border border-slate-300 px-2.5 py-2" colSpan={2}>
              {promedio != null ? desempeno(promedio).label : "Sin evaluar"}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Asistencia del periodo */}
      <section className="mt-4 border border-slate-300 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Resumen de asistencia del periodo
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
          {[
            { label: "Sesiones", value: asistenciaPeriodo.length },
            { label: "Presentes", value: presentes },
            { label: "Faltas", value: faltas },
            { label: "Retardos", value: retardos },
            { label: "Excusas", value: excusas },
          ].map((m) => (
            <div key={m.label} className="rounded-md border border-slate-200 py-1.5">
              <p className="font-mono text-base font-semibold tabular-nums">{m.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Observaciones generales */}
      <section className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Observaciones generales
        </p>
        {imprimible ? (
          <p className="mt-1 min-h-16 whitespace-pre-wrap border border-slate-300 px-3 py-2 text-[12px] text-slate-700">
            {observaciones || " "}
          </p>
        ) : (
          <textarea
            value={observaciones}
            onChange={(e) => onObservaciones?.(e.target.value)}
            placeholder="Comentarios del director de grupo o docente (se incluyen al imprimir)."
            className="mt-1 min-h-16 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-500"
          />
        )}
      </section>

      {/* Firmas */}
      <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { rol: "Docente / Director(a) de grupo", nombre: director },
          { rol: "Rector(a) / Coordinación", nombre: null },
          { rol: "Acudiente", nombre: acudiente || null },
        ].map((f) => (
          <div key={f.rol} className="text-center">
            <div className="border-t border-slate-400 pt-1.5">
              <p className="text-[11px] font-medium">{f.nombre ?? "\u00a0"}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{f.rol}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="mt-6 text-center text-[9px] text-slate-400">
        Documento generado por SIA · Sistema Integral Académico
      </p>
    </article>
  );
}

/**
 * Boletín académico formal de un estudiante para un periodo.
 *
 * En pantalla se muestra dentro del panel; al imprimir se aisla una copia
 * renderizada en un portal sobre `body` (misma técnica que CarnetsAsistencia)
 * para que el sidebar y el resto de la interfaz no se impriman.
 */
export function BoletinAcademico(props: BoletinProps) {
  const [observaciones, setObservaciones] = useState("");

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #sia-boletin, #sia-boletin * { visibility: visible !important; }
          #sia-boletin {
            position: absolute; left: 0; top: 0; width: 100%;
            background: #fff !important; color: #000 !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          #sia-boletin .no-print { display: none !important; }
          #sia-boletin tr, #sia-boletin td, #sia-boletin th { break-inside: avoid; }
          @page { size: letter portrait; margin: 1.5cm; }
        }
      `}</style>

      <div className="print:hidden">
        <DocumentoBoletin
          {...props}
          observaciones={observaciones}
          onObservaciones={setObservaciones}
          imprimible={false}
        />
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <div id="sia-boletin" className="hidden bg-white print:block">
            <DocumentoBoletin {...props} observaciones={observaciones} imprimible />
          </div>,
          document.body,
        )}
    </>
  );
}
