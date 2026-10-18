import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { BoletinAcademico, type BoletinAsistencia, type BoletinNota } from "../BoletinAcademico";

function nota(overrides: Partial<BoletinNota>): BoletinNota {
  return {
    grupo_id: 1,
    periodo: "2026-P1",
    horario: null,
    materia: "Matemáticas",
    materia_codigo: "MAT-6",
    profesor: "Docente Demo",
    nota_1: null,
    nota_2: null,
    nota_3: null,
    examen_final: null,
    nota_definitiva: null,
    observaciones: null,
    ...overrides,
  };
}

const notas: BoletinNota[] = [
  nota({ grupo_id: 1, nota_definitiva: 4.8, observaciones: "Buen desempeño" }),
  nota({
    grupo_id: 2,
    materia: "Lengua Castellana",
    materia_codigo: "LEN-6",
    nota_definitiva: 3.2,
  }),
  nota({
    grupo_id: 3,
    materia: "Ciencias Naturales",
    materia_codigo: "CIE-6",
    periodo: "2026-P2",
    nota_definitiva: 2.0,
  }),
];

const asistencia: BoletinAsistencia[] = [
  {
    fecha: "2026-02-02",
    estado: "presente",
    observacion: null,
    materia: "Matemáticas",
    periodo: "2026-P1",
  },
  {
    fecha: "2026-02-03",
    estado: "ausente",
    observacion: null,
    materia: "Matemáticas",
    periodo: "2026-P1",
  },
  {
    fecha: "2026-02-04",
    estado: "tarde",
    observacion: null,
    materia: "Matemáticas",
    periodo: "2026-P1",
  },
];

const props = {
  estudiante: { id: 5, nombre: "Estudiante Demo", correo: "est@sia.edu.co", foto_url: null },
  curso: { nombre: "A", grado: "Sexto", ano_lectivo: 2026, director: "Docente Demo" },
  institucion: {
    nombre: "Colegio Ejemplo",
    correo: "info@cej.edu.co",
    telefono: "601 5555",
    departamento: "Cundinamarca",
    ciudad: "Bogotá",
    logo_url: null,
  },
  notas,
  asistencia,
  periodo: "2026-P1",
  acudiente: "Acudiente Demo",
};

describe("BoletinAcademico", () => {
  it("muestra el encabezado institucional y los datos del estudiante", () => {
    const { container } = render(<BoletinAcademico {...props} />);
    const vista = within(container);
    expect(vista.getByText("Colegio Ejemplo")).toBeInTheDocument();
    expect(vista.getByText("Estudiante Demo")).toBeInTheDocument();
    expect(vista.getAllByText("Acudiente Demo").length).toBeGreaterThan(0);
    expect(vista.getByText("Sexto A")).toBeInTheDocument();
  });

  it("filtra las materias por periodo y muestra profesor y desempeño cualitativo", () => {
    const { container } = render(<BoletinAcademico {...props} />);
    const vista = within(container);
    expect(vista.getByText("Matemáticas")).toBeInTheDocument();
    expect(vista.getByText("Lengua Castellana")).toBeInTheDocument();
    expect(vista.queryByText("Ciencias Naturales")).not.toBeInTheDocument();
    expect(vista.getAllByText("Docente Demo").length).toBeGreaterThan(0);
    expect(vista.getByText("Superior")).toBeInTheDocument();
    expect(vista.getByText("Básico")).toBeInTheDocument();
    expect(vista.getByText("Buen desempeño")).toBeInTheDocument();
  });

  it("calcula el promedio del periodo y resume la asistencia", () => {
    const { container } = render(<BoletinAcademico {...props} />);
    const vista = within(container);
    // (4.8 + 3.2) / 2 = 4.00 → Alto
    expect(vista.getByText("4.00")).toBeInTheDocument();
    expect(vista.getByText("Alto")).toBeInTheDocument();
    expect(vista.getByText("Faltas")).toBeInTheDocument();
    expect(vista.getByText("Retardos")).toBeInTheDocument();
  });
});
