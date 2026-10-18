import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  agregarPendiente,
  leerPendientes,
  quitarPendiente,
  contarPendientes,
  sincronizarPendientes,
  hayRed,
  type PendienteAsistencia,
} from "@/lib/asistencia-offline";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

import { api } from "@/lib/api";

const base: Omit<PendienteAsistencia, "encolado_en"> = {
  grupo_id: 5,
  fecha: "2026-01-08",
  registros: [{ matricula_id: 1, estado: "presente", observacion: null }],
};

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  (api as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("cola de asistencia offline (localStorage)", () => {
  it("empieza vacía", () => {
    expect(leerPendientes()).toEqual([]);
    expect(contarPendientes()).toBe(0);
  });

  it("encola una toma y la puede leer", () => {
    agregarPendiente(base);
    const lista = leerPendientes();
    expect(lista).toHaveLength(1);
    expect(lista[0].grupo_id).toBe(5);
    expect(lista[0].fecha).toBe("2026-01-08");
    expect(lista[0].encolado_en).toBeTruthy();
  });

  it("reemplaza la pendiente del mismo grupo+fecha (la última gana)", () => {
    agregarPendiente({
      ...base,
      registros: [{ matricula_id: 1, estado: "tarde", observacion: null }],
    });
    agregarPendiente({
      ...base,
      registros: [{ matricula_id: 1, estado: "ausente", observacion: "Fallo" }],
    });
    expect(leerPendientes()).toHaveLength(1);
    expect(leerPendientes()[0].registros[0].estado).toBe("ausente");
  });

  it("soporta varias fechas a la vez", () => {
    agregarPendiente({ ...base, fecha: "2026-01-08" });
    agregarPendiente({ ...base, fecha: "2026-01-09" });
    expect(contarPendientes()).toBe(2);
  });

  it("quitarPendiente borra solo el par grupo+fecha", () => {
    agregarPendiente({ ...base, fecha: "2026-01-08" });
    agregarPendiente({ ...base, fecha: "2026-01-09" });
    quitarPendiente(5, "2026-01-08");
    expect(contarPendientes()).toBe(1);
    expect(leerPendientes()[0].fecha).toBe("2026-01-09");
  });
});

describe("sincronizarPendientes", () => {
  it("envía cada pendiente y vacía la cola al ser exitoso", async () => {
    agregarPendiente({ ...base, fecha: "2026-01-08" });
    agregarPendiente({ ...base, fecha: "2026-01-09" });
    const r = await sincronizarPendientes();
    expect(r).toEqual({ subidos: 2, fallidos: 0 });
    expect(api).toHaveBeenCalledTimes(2);
    expect(contarPendientes()).toBe(0);
  });

  it("manda la justificación solo cuando existe", async () => {
    agregarPendiente({ ...base, justificacion: "Ajuste por offline" });
    await sincronizarPendientes();
    const cuerpo = (api as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(JSON.parse(cuerpo.body).justificacion).toBe("Ajuste por offline");
  });

  it("no envía justificación vacía", async () => {
    agregarPendiente({ ...base, justificacion: "" });
    await sincronizarPendientes();
    const cuerpo = (api as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(JSON.parse(cuerpo.body).justificacion).toBeUndefined();
  });

  it("se detiene y conserva la cola ante un error", async () => {
    (api as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValueOnce({ ok: true });
    agregarPendiente({ ...base, fecha: "2026-01-08" });
    agregarPendiente({ ...base, fecha: "2026-01-09" });
    const r = await sincronizarPendientes();
    expect(r.fallidos).toBe(1);
    expect(contarPendientes()).toBe(2);
  });
});

describe("hayRed", () => {
  it("lee navigator.onLine en el navegador", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    expect(hayRed()).toBe(true);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    expect(hayRed()).toBe(false);
  });
});
