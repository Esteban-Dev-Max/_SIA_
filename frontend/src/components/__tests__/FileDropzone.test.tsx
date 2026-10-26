import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDropzone } from "../FileDropzone";
import { TAMANO_MAX_ENTREGA } from "@/lib/archivos";

function seleccionar(input: HTMLInputElement, file: File) {
  return userEvent.upload(input, file);
}

describe("FileDropzone", () => {
  it("acepta un archivo válido y lo informa al padre", async () => {
    const onArchivo = vi.fn();
    const { container } = render(<FileDropzone archivo={null} onArchivo={onArchivo} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    await seleccionar(input!, new File(["contenido"], "tarea.pdf", { type: "application/pdf" }));
    expect(onArchivo).toHaveBeenCalledTimes(1);
    expect(onArchivo.mock.calls[0][0]).toBeInstanceOf(File);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rechaza formatos no permitidos con un mensaje claro", () => {
    const onArchivo = vi.fn();
    render(<FileDropzone archivo={null} onArchivo={onArchivo} />);
    const zona = screen.getByRole("button", { name: /seleccionar archivo/i });

    // El selector nativo filtra por accept; el arrastre sí puede traer otros formatos.
    fireEvent.drop(zona, {
      dataTransfer: {
        files: [new File(["x"], "virus.exe", { type: "application/octet-stream" })],
      },
    });
    expect(onArchivo).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert").textContent).toMatch(/Formato no permitido/i);
  });

  it("rechaza archivos que superan el tamaño máximo", async () => {
    const onArchivo = vi.fn();
    const { container } = render(<FileDropzone archivo={null} onArchivo={onArchivo} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const grande = new File(["x"], "tarea.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: TAMANO_MAX_ENTREGA + 1 });

    await seleccionar(input!, grande);
    expect(onArchivo).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert").textContent).toMatch(/tamaño máximo/i);
  });

  it("muestra el archivo seleccionado y permite quitarlo", async () => {
    const onArchivo = vi.fn();
    render(
      <FileDropzone
        archivo={new File(["x"], "ensayo.docx", { type: "application/msword" })}
        onArchivo={onArchivo}
      />,
    );
    expect(screen.getByText("ensayo.docx")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /quitar/i }));
    expect(onArchivo).toHaveBeenCalledWith(null);
  });
});
