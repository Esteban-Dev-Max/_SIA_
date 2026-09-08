import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { login } from "../helpers/auth.js";
import { pool } from "../../db.js";
import { mailer } from "../../lib/mailer.js";

// ---------------------------------------------------------------------------
// Flujo de recuperación de contraseña: forgot-password (envío del enlace) y
// reset-password (cambio real de la clave). Usa un usuario dedicado creado
// aquí mismo para no alterar las credenciales demo que otros tests reutilizan.
// ---------------------------------------------------------------------------

const USER = {
  nombre_completo: "Usuario Reset Tests",
  correo: `reset${Date.now()}@test.edu.co`,
  password: "claveOriginal123",
  rol: "estudiante",
};

let usuarioId;
let tokenValido;
let enviados;

function sha256(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const MSG_GENERICO =
  "Si el correo está registrado, recibirás las instrucciones en tu bandeja de entrada";

before(async () => {
  const hash = await bcrypt.hash(USER.password, 10);
  const [res] = await pool.query(
    "INSERT INTO usuarios (nombre_completo, correo, `password`, rol, estado) VALUES (?, ?, ?, ?, 'activo')",
    [USER.nombre_completo, USER.correo, hash, USER.rol],
  );
  usuarioId = res.insertId;

  // Espía el envío de correos: captura el payload en lugar de enviar.
  enviados = [];
  mailer.enviar = async (opts) => {
    enviados.push(opts);
    return { enviado: true };
  };
});

after(async () => {
  await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
  await teardownDB();
});

function extraerToken(html) {
  const m = html.match(/reset-password\?token=([a-f0-9]{64})/);
  return m ? m[1] : null;
}

test("POST /api/auth/forgot-password con correo registrado responde mensaje genérico y guarda el token", async () => {
  const res = await request(app)
    .post("/api/auth/forgot-password")
    .send({ correo: USER.correo });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, MSG_GENERICO);

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].para, USER.correo);
  assert.equal(enviados[0].asunto, "Recuperación de contraseña — SIA");
  assert.ok(enviados[0].html, "el correo debe llevar HTML");

  tokenValido = extraerToken(enviados[0].html);
  assert.ok(tokenValido, "el enlace debe incluir el token");

  const [rows] = await pool.query(
    "SELECT token_hash, expira_en, usado FROM password_resets WHERE usuario_id = ?",
    [usuarioId],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha256(tokenValido));
  assert.equal(rows[0].usado, 0);
  assert.ok(
    new Date(rows[0].expira_en).getTime() > Date.now(),
    "el token no debe estar expirado",
  );
});

test("POST /api/auth/forgot-password con correo inexistente responde el mismo mensaje genérico y no envía correo", async () => {
  const res = await request(app)
    .post("/api/auth/forgot-password")
    .send({ correo: "nadie@noexiste.edu.co" });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, MSG_GENERICO);
  assert.equal(enviados.length, 1, "no debe enviarse otro correo");
});

test("POST /api/auth/forgot-password sin correo devuelve 400", async () => {
  const res = await request(app).post("/api/auth/forgot-password").send({});
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

test("POST /api/auth/reset-password con token válido cambia la contraseña y lo invalida", async () => {
  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ token: tokenValido, password: "nuevaClaveSegura1" });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const nuevoLogin = await login(USER.correo, "nuevaClaveSegura1");
  assert.equal(nuevoLogin.user.correo, USER.correo);

  const viejoLogin = await request(app)
    .post("/api/auth/login")
    .send({ correo: USER.correo, password: USER.password });
  assert.equal(viejoLogin.status, 401);

  const reuso = await request(app)
    .post("/api/auth/reset-password")
    .send({ token: tokenValido, password: "otraClave123" });
  assert.equal(reuso.status, 400, "el token usado no debe servir dos veces");
});

test("POST /api/auth/reset-password con token inválido o expirado devuelve 400", async () => {
  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ token: "token-inventado", password: "claveNueva123" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /no es válido o ha expirado/);
});

test("POST /api/auth/reset-password con contraseña corta devuelve 400", async () => {
  const nuevoToken = await request(app)
    .post("/api/auth/forgot-password")
    .send({ correo: USER.correo });
  assert.equal(nuevoToken.status, 200);
  const token = extraerToken(enviados[enviados.length - 1].html);

  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ token, password: "abc" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /al menos 6 caracteres/);
});

test("POST /api/auth/reset-password sin token ni contraseña devuelve 400", async () => {
  const res = await request(app).post("/api/auth/reset-password").send({});
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});