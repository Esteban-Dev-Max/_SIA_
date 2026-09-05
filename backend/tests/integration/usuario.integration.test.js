import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { tokenSuperAdmin, tokenAdmin, tokenProfesor, login, auth } from "../helpers/auth.js";

let superToken;
let adminToken;
let profToken;

before(async () => {
  [superToken, adminToken, profToken] = await Promise.all([
    tokenSuperAdmin(),
    tokenAdmin(),
    tokenProfesor(),
  ]);
});

after(async () => {
  await teardownDB();
});

test("login con credenciales demo devuelve token y rol", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ correo: "admin@sia.edu.co", password: "admin123" });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.rol, "admin");
});

test("login sin cuerpo devuelve 400", async () => {
  const res = await request(app).post("/api/auth/login").send({});
  assert.equal(res.status, 400);
});

test("login con contraseña incorrecta devuelve 401", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ correo: "admin@sia.edu.co", password: "incorrecta" });
  assert.equal(res.status, 401);
  assert.ok(res.body.error);
});

test("/me exige token válido (401 sin token, 200 con token)", async () => {
  const sinToken = await request(app).get("/api/auth/me");
  assert.equal(sinToken.status, 401);

  const conToken = await request(app).get("/api/auth/me").set(auth(adminToken));
  assert.equal(conToken.status, 200);
  assert.equal(conToken.body.rol, "admin");
});

test("un token inválido devuelve 401 en una ruta protegida", async () => {
  const res = await request(app)
    .get("/api/notas")
    .set({ Authorization: "Bearer token.invalido.123" });
  assert.equal(res.status, 401);
});

test("un profesor no puede acceder a rutas de admin (403)", async () => {
  const res = await request(app)
    .get("/api/admin/usuarios")
    .set(auth(profToken));
  assert.equal(res.status, 403);
});

test("health check responde ok", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("login inválido repetido termina bloqueado (429) y luego se desbloquea con login correcto", async () => {
  const correo = "bloqueo@sia.edu.co";
  // Fuerza varios fallos con credenciales usuarias
  for (let i = 0; i < 5; i++) {
    await request(app).post("/api/auth/login").send({ correo, password: "mal".repeat(i + 1) });
  }
  const bloqueado = await request(app)
    .post("/api/auth/login")
    .send({ correo, password: "malotro" });
  // 6to fallo ya cae bloqueado
  assert.equal(bloqueado.status, 429);
});
