const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

export function setSession(token: string, user: AuthUser) {
  window.localStorage.setItem("token", token);
  window.localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export type Rol = "admin" | "profesor" | "estudiante";
export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
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
