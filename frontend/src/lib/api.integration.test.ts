import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getToken,
  setSession,
  clearSession,
  getUser,
  api,
  urlRecurso,
  type AuthUser,
} from "@/lib/api";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// --------------- getToken / setSession / clearSession / getUser ---------------

describe("session management", () => {
  const mockUser: AuthUser = {
    id: 1,
    nombre: "Test User",
    correo: "test@test.co",
    rol: "admin",
    foto_url: null,
    institucion_id: null,
    institucion_logo: null,
  };

  it("setSession guarda token y user en localStorage por defecto", () => {
    setSession("abc", mockUser);
    expect(getToken()).toBe("abc");
    expect(getUser()).toEqual(mockUser);
  });

  it("setSession con remember=false usa sessionStorage", () => {
    setSession("xyz", mockUser, false);
    expect(getToken()).toBe("xyz");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.sessionStorage.getItem("token")).toBe("xyz");
  });

  it("getToken retorna null si no hay token", () => {
    expect(getToken()).toBeNull();
  });

  it("clearSession limpia ambos stores", () => {
    setSession("abc", mockUser);
    clearSession();
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("getUser retorna null si el JSON está corrupto", () => {
    window.localStorage.setItem("user", "not-json");
    expect(getUser()).toBeNull();
  });
});

// --------------- urlRecurso ----------------

describe("urlRecurso", () => {
  it("retorna vacío si path es null o undefined", () => {
    expect(urlRecurso(null)).toBe("");
    expect(urlRecurso(undefined)).toBe("");
  });

  it("retorna URLs absolutas sin modificar", () => {
    expect(urlRecurso("https://cdn.example.com/img.png")).toBe("https://cdn.example.com/img.png");
    expect(urlRecurso("http://other.com/x.jpg")).toBe("http://other.com/x.jpg");
  });

  it("resuelve paths relativos con API_URL", () => {
    const result = urlRecurso("/api/uploads/logos/test.png");
    // En jsdom, window.location.protocol es "http:" → API_URL = "http://localhost:3001"
    expect(result).toBe("http://localhost:3001/api/uploads/logos/test.png");
  });
});

// --------------- api() ----------------

describe("api()", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("envía Content-Type application/json y el token de autorización", async () => {
    window.localStorage.setItem("token", "tok123");
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ v: 1 }) });

    const result = await api("/api/test");
    expect(result).toEqual({ v: 1 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:3001/api/test");
    expect(opts.headers["Authorization"]).toBe("Bearer tok123");
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("no envía Content-Type cuando body es FormData", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["x"]), "test.txt");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    await api("/api/upload", { method: "POST", body: fd });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Content-Type"]).toBeUndefined();
  });

  it("lanza error con mensaje del backend cuando la respuesta falla", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Dato inválido" }),
    });

    await expect(api("/api/fail")).rejects.toThrow("Dato inválido");
  });

  it("retorna undefined para status 204 (sin body)", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve({}) });

    const result = await api("/api/no-content", { method: "DELETE" });
    expect(result).toBeUndefined();
  });
});
