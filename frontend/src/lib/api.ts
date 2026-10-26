/** Resuelve la base de la API:
 * - Navegador sobre HTTPS (túnel de publicación, p. ej. Tailscale Funnel): usa paths
 *   relativos /api/* — la puerta de enlace enruta /api/* al backend (misma-origen, sin CORS).
 * - Navegador sobre HTTP (localhost o IP LAN): usa el mismo host + puerto 3001, para que
 *   fetch no apunte a localhost desde otra máquina.
 * - Servidor (SSR): VITE_API_URL o localhost:3001 directo (loopback, sin pasar por el túnel). */
function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.protocol === "https:") return "";
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:3001";
}

const API_URL = resolveApiUrl();

/** Resuelve la URL pública de un recurso estático del backend (p. ej. un avatar
 * guardado como "/api/uploads/avatars/x.jpg") según el mismo criterio de
 * resolveApiUrl: relativo en HTTPS, host:3001 en HTTP LAN y VITE_API_URL en SSR. */
export function urlRecurso(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path}`;
}

export type Rol = "superadmin" | "admin" | "profesor" | "estudiante" | "acudiente";
export interface AuthUser {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  foto_url: string | null;
  institucion_id: number | null;
  institucion_logo: string | null;
  institucion_estado?: "activo" | "inactivo" | null;
  institucion_nombre?: string | null;
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

/** Ante un 401 con sesión iniciada: limpia las credenciales y vuelve al login. */
function manejarSesionExpirada() {
  if (typeof window === "undefined") return;
  clearSession();
  if (window.location.pathname !== "/login") window.location.assign("/login");
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
    if (res.status === 401 && token) manejarSesionExpirada();
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Porcentaje (0–100) del progreso de subida. */
export type ProgresoSubida = (porcentaje: number) => void;

/** Sube un FormData informando el progreso real (fetch no expone el avance).
 * Usa XHR porque es la única API que reporta el progreso de subida. */
export function apiSubir<T = unknown>(
  path: string,
  formData: FormData,
  onProgress?: ProgresoSubida,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof XMLHttpRequest === "undefined") {
      reject(new Error("La subida de archivos requiere un navegador"));
      return;
    }
    const token = getToken();
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(path));
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.upload.onload = () => onProgress(100);
    }
    xhr.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
    xhr.onabort = () => reject(new Error("Subida cancelada"));
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      if (xhr.status === 401 && token) manejarSesionExpirada();
      const mensaje = (data as { error?: string } | null)?.error || `HTTP ${xhr.status}`;
      reject(new Error(mensaje));
    };
    xhr.send(formData);
  });
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
    if (res.status === 401 && token) manejarSesionExpirada();
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
