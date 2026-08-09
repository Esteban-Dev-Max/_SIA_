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
  const isFormData =
    typeof window !== "undefined" &&
    typeof FormData !== "undefined" &&
    opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  // Con FormData el navegador fija el Content-Type/multipart (con boundary).
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** Fetch autenticado del backend (para subir/descargar archivos con el token). */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res;
}

/** Baja un archivo del backend como Blob (con autenticación Bearer). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await apiFetch(path);
  return res.blob();
}

/** Abre un adjunto (PDF/JPG/PNG) en una pestaña nueva usando un blob autenticado. */
export async function vistaArchivo(path: string): Promise<void> {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

/** Descarga un adjunto autenticado usando el nombre original como nombre de archivo. */
export async function descargarArchivo(path: string, nombre: string): Promise<void> {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
