import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstitucionModal, type Institucion } from "../InstitucionModal";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  urlRecurso: (u: string) => u,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const { api } = await import("@/lib/api");
const { toast } = await import("sonner");

const institucion: Institucion = {
  id: 7,
  nombre: "Colegio Ejemplo",
  correo: "info@cej.edu.co",
  telefono: "601 5555",
  departamento: "Cundinamarca",
  ciudad: "Bogotá",
  estado: "activo",
  logo_url: null,
};

const onSaved = vi.fn();
const onOpenChange = vi.fn();
const mockApi = api as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InstitucionModal", () => {
  it("muestra el título de creación cuando no hay edición", () => {
    render(<InstitucionModal open onOpenChange={onOpenChange} editando={null} onSaved={onSaved} />);
    expect(screen.getByText("Nueva institución")).toBeInTheDocument();
  });

  it("muestra el título de edición y precarga los datos", () => {
    render(
      <InstitucionModal
        open
        onOpenChange={onOpenChange}
        editando={institucion}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByText("Editar institución")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la institución")).toHaveValue("Colegio Ejemplo");
  });

  it("no guarda si el nombre está vacío", async () => {
    const user = userEvent.setup();
    render(<InstitucionModal open onOpenChange={onOpenChange} editando={null} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: /crear institución/i }));
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("crea una institución vía POST al enviar el formulario", async () => {
    const user = userEvent.setup();
    mockApi.mockResolvedValue({ id: 99 });
    render(<InstitucionModal open onOpenChange={onOpenChange} editando={null} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Nombre de la institución"), "Colegio Prueba");
    await user.click(screen.getByRole("button", { name: /crear institución/i }));

    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
    const [url, opts] = mockApi.mock.calls[0];
    expect(url).toBe("/api/instituciones");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.nombre).toBe("Colegio Prueba");
  });

  it("edita una institución existente vía PUT al enviar", async () => {
    const user = userEvent.setup();
    mockApi.mockResolvedValue({ id: institucion.id });
    render(
      <InstitucionModal
        open
        onOpenChange={onOpenChange}
        editando={institucion}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nombre de la institución"), {
      target: { value: "Colegio Renombrado" },
    });
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
    const [url, opts] = mockApi.mock.calls[0];
    expect(url).toBe("/api/instituciones/7");
    expect(opts.method).toBe("PUT");
  });

  it("muestra la sección de administrador inicial solo en creación", () => {
    render(<InstitucionModal open onOpenChange={onOpenChange} editando={null} onSaved={onSaved} />);
    expect(screen.getByText("Administrador inicial (opcional)")).toBeInTheDocument();
  });

  it("oculta la sección de administrador inicial en edición", () => {
    render(
      <InstitucionModal
        open
        onOpenChange={onOpenChange}
        editando={institucion}
        onSaved={onSaved}
      />,
    );
    expect(screen.queryByText("Administrador inicial (opcional)")).not.toBeInTheDocument();
  });

  it("llama onOpenChange(false) al cancelar", async () => {
    const user = userEvent.setup();
    render(<InstitucionModal open onOpenChange={onOpenChange} editando={null} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("notifica y cierra al guardar con éxito", async () => {
    const user = userEvent.setup();
    mockApi.mockResolvedValue({ id: 99 });
    render(<InstitucionModal open onOpenChange={onOpenChange} editando={null} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("Nombre de la institución"), "Colegio Cierre");
    await user.click(screen.getByRole("button", { name: /crear institución/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Institución creada"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSaved).toHaveBeenCalled();
  });
});
