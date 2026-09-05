import request from "supertest";
import { app } from "./app.js";

/** Inicia sesión con credenciales demo y devuelve { token, user } o lanza. */
export async function login(correo, password) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ correo, password });
  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body; // { token, user }
}

/** Token de superadmin demo. */
export async function tokenSuperAdmin() {
  return (await login("superadmin@sia.edu.co", "superadmin123")).token;
}

/** Token de admin de la institución demo. */
export async function tokenAdmin() {
  return (await login("admin@sia.edu.co", "admin123")).token;
}

/** Token de profesor demo. */
export async function tokenProfesor() {
  return (await login("profesor@sia.edu.co", "prof123")).token;
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}
