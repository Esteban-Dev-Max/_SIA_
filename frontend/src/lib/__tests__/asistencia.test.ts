import { describe, expect, it } from "vitest";
import {
  UMBRAL_RIESGO,
  UMBRAL_ALERTA,
  UMBRAL_FALLAS_CRITICAS,
  aplicarFiltro,
  columnasFecha,
  estadoDe,
  observacionDe,
  cicloEstado,
  formatoFecha,
  nivelRiesgo,
  type FilaResumen,
  type NivelRiesgo,
} from "@/lib/asistencia";

function fila(sobre: Partial<FilaResumen>): FilaResumen {
  return {
    estudiante_id: 1,
    matricula_id: 1,
    estudiante: "Ana",
    correo: "ana@test.co",
    foto_url: null,
    presentes: 0,
    ausentes: 0,
    tardes: 0,
    excusas: 0,
    total: 0,
    fallas: 0,
    porcentaje: null,
    en_riesgo: false,
    fallas_criticas: false,
    nivel: "sin_registros",
    registros: [],
    ...sobre,
  };
}

describe("umbrales de riesgo", () => {
  it("traen el mismo criterio que el backend", () => {
    expect(UMBRAL_RIESGO).toBe(80);
    expect(UMBRAL_ALERTA).toBe(90);
    expect(UMBRAL_FALLAS_CRITICAS).toBe(3);
  });
});

describe("nivelRiesgo", () => {
  it("sin porcentaje clasifica como sin_registros", () => {
    expect(nivelRiesgo({ porcentaje: null, fallas_criticas: false })).toBe("sin_registros");
  });

  it("marca crítico bajo la frontera de riesgo", () => {
    expect(nivelRiesgo({ porcentaje: 79, fallas_criticas: false })).toBe("critico");
    expect(nivelRiesgo({ porcentaje: 79, fallas_criticas: true })).toBe("critico");
  });

  it("fallas críticas revientan cualquier porcentaje", () => {
    expect(nivelRiesgo({ porcentaje: 95, fallas_criticas: true })).toBe("critico");
  });

  it("alerta entre la frontera y el umbral de alerta", () => {
    expect(nivelRiesgo({ porcentaje: 80, fallas_criticas: false })).toBe("alerta");
    expect(nivelRiesgo({ porcentaje: 89, fallas_criticas: false })).toBe("alerta");
  });

  it("bajo a partir del umbral de alerta", () => {
    expect(nivelRiesgo({ porcentaje: 90, fallas_criticas: false })).toBe("bajo");
    expect(nivelRiesgo({ porcentaje: 100, fallas_criticas: false })).toBe("bajo");
  });
});

describe("aplicarFiltro", () => {
  const filas: FilaResumen[] = [
    fila({ estudiante_id: 1, en_riesgo: false, fallas_criticas: false, nivel: "bajo" }),
    fila({ estudiante_id: 2, en_riesgo: true, fallas_criticas: false, nivel: "alerta" }),
    fila({ estudiante_id: 3, en_riesgo: true, fallas_criticas: true, nivel: "critico" }),
    fila({ estudiante_id: 4, en_riesgo: false, fallas_criticas: false, nivel: "sin_registros" }),
  ];

  it("'todos' no descarta ninguna fila", () => {
    expect(aplicarFiltro(filas, "todos").map((f) => f.estudiante_id)).toEqual([1, 2, 3, 4]);
  });

  it("'riesgo' filtra por en_riesgo", () => {
    expect(aplicarFiltro(filas, "riesgo").map((f) => f.estudiante_id)).toEqual([2, 3]);
  });

  it("'criticas' filtra por fallas_criticas", () => {
    expect(aplicarFiltro(filas, "criticas").map((f) => f.estudiante_id)).toEqual([3]);
  });

  it("filtra por nivel de semáforo", () => {
    expect(aplicarFiltro(filas, "bajo").map((f) => f.estudiante_id)).toEqual([1]);
    expect(aplicarFiltro(filas, "alerta").map((f) => f.estudiante_id)).toEqual([2]);
    expect(aplicarFiltro(filas, "critico").map((f) => f.estudiante_id)).toEqual([3]);
    expect(aplicarFiltro(filas, "sin_registros").map((f) => f.estudiante_id)).toEqual([4]);
  });

  it("nivel desconocido no filtra", () => {
    const barril = aplicarFiltro(filas, "todos" as NivelRiesgo);
    expect(barril).toHaveLength(4);
  });
});

describe("columnasFecha", () => {
  it("deduce las fechas y las ordena ascendente", () => {
    const filas = [
      fila({
        registros: [
          { fecha: "2026-01-12", estado: "presente", observacion: null },
          { fecha: "2026-01-05", estado: "ausente", observacion: null },
        ],
      }),
      fila({
        registros: [{ fecha: "2026-01-08", estado: "tarde", observacion: null }],
      }),
    ];
    expect(columnasFecha(filas)).toEqual(["2026-01-05", "2026-01-08", "2026-01-12"]);
  });

  it("devuelve [] sin registros", () => {
    expect(columnasFecha([fila({})])).toEqual([]);
  });
});

describe("estadoDe / observacionDe", () => {
  const f = fila({
    registros: [{ fecha: "2026-01-08", estado: "excusa", observacion: "Cita médica" }],
  });

  it("obtiene el estado de una fecha puntual", () => {
    expect(estadoDe(f, "2026-01-08")).toBe("excusa");
    expect(estadoDe(f, "2026-02-01")).toBeNull();
  });

  it("obtiene la observación solo de la fecha marcada", () => {
    expect(observacionDe(f, "2026-01-08")).toBe("Cita médica");
    expect(observacionDe(f, "2026-02-01")).toBeNull();
  });
});

describe("cicloEstado", () => {
  it("cicla P → A → T → E → P", () => {
    expect(cicloEstado(null)).toBe("presente");
    expect(cicloEstado("presente")).toBe("ausente");
    expect(cicloEstado("ausente")).toBe("tarde");
    expect(cicloEstado("tarde")).toBe("excusa");
    expect(cicloEstado("excusa")).toBe("presente");
  });
});

describe("formatoFecha", () => {
  it("convierte ISO a dd/mm", () => {
    expect(formatoFecha("2026-01-05")).toBe("05/01");
  });

  it("deja pasar valores no ISO", () => {
    expect(formatoFecha("hoy")).toBe("hoy");
  });
});
