import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { auth, login } from "../helpers/auth.js";
import { pool } from "../../db.js";

// ---------------------------------------------------------------------------
// Cambio de contraseña autenticado (POST /api/auth/cambiar-password).
// Usa un usuario dedicado para no alterar las credenciales demo. Los tests de
// validación van antes del cambio real (que muta la contraseña).
// ---------------------------------------------------------------------------

const sufi = () =>
  `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

const correo = `pwd-${sufi()}@test.edu.co`;
const original = "claveOriginal1";
const nueva = "nuevaClaveSegura1";

let userId;
let token;

before(async () => {
  const hash = await bcrypt.hash(original, 10);
  const [res] = await pool.query(
    "INSERT INTO usuarios (nombre_completo, correo, `password`, rol, estado) VALUES (?, ?, ?, 'estudiante', 'activo')",
    ["Usuario Password QA", correo, hash],
  );
  userId = res.insertId;
  token = (await login(correo, original)).token;
});

after(async () => {
  await pool.query("DELETE FROM usuarios WHERE id = ?", [userId]);
  await teardownDB();
});

test("sin token devuelve 401", async () => {
  const res = await request(app)
    .post("/api/auth/cambiar-password")
    .send({ password_actual: original, password_nueva: nueva });
  assert.equal(res.status, 401);
});

test("sin datos devuelve 400", async () => {
  const res = await request(app)
    .post("/api/auth/cambiar-password")
    .set(auth(token))
    .send({});
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

test("contraseña nueva corta devuelve 400", async () => {
  const res = await request(app)
    .post("/api/auth/cambiar-password")
    .set(auth(token))
    .send({ password_actual: original, password_nueva: "123" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /al menos 6 caracteres/);
});

test("contraseña actual incorrecta devuelve 400", async () => {
  const res = await request(app)
    .post("/api/auth/cambiar-password")
    .set(auth(token))
    .send({ password_actual: "noEsLaActual", password_nueva: nueva });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /actual no es correcta/);
});

test("la nueva contraseña no puede ser igual a la actual", async () => {
  const res = await request(app)
    .post("/api/auth/cambiar-password")
    .set(auth(token))
    .send({ password_actual: original, password_nueva: original });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /igual a la actual/);
});

test("cambia la contraseña y la anterior deja de servir", async () => {
  const res = await request(app)
    .post("/api/auth/cambiar-password")
    .set(auth(token))
    .send({ password_actual: original, password_nueva: nueva });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, true);

  const nuevo = await login(correo, nueva);
  assert.equal(nuevo.user.correo, correo);

  const viejo = await request(app)
    .post("/api/auth/login")
    .send({ correo, password: original });
  assert.equal(viejo.status, 401);
});
