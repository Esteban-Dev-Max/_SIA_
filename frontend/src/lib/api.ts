/** Usa el mismo host que la UI (localhost o IP LAN) para que fetch no apunte a localhost desde otra máquina. */
function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:3001";
}

const API_URL = resolveApiUrl();

export type Rol = "admin" | "profesor" | "estudiante" | "acudiente";
export interface AuthUser {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  foto_url: string | null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token") ?? window.sessionStorage.getItem("token");
}

export function setSession(token: string, user: AuthUser, remember = true) {
  const store = remember ? window.localStorage : window.sessionStorage;
  store.setItem("token", token);
  store.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
  window.sessionStorage.removeItem("token");
  window.sessionStorage.removeItem("user");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("user") ?? window.sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
