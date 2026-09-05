import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { tokenSuperAdmin, tokenAdmin, tokenProfesor, auth } from "../helpers/auth.js";

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

test("GET /api/instituciones exige token (401 sin token)", async () => {
  const res = await request(app).get("/api/instituciones");
  assert.equal(res.status, 401);
});

test("GET /api/instituciones devuelve la institución demo", async () => {
  const res = await request(app)
    .get("/api/instituciones")
    .set(auth(superToken));
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const demo = res.body.find((i) => i.nombre === "Instituto Demostración SIA");
  assert.ok(demo, "debe existir la institución demo");
  assert.equal(demo.estado, "activo");
});

test("POST /api/instituciones sin nombre devuelve 400", async () => {
  const res = await request(app)
    .post("/api/instituciones")
    .set(auth(superToken))
    .send({ correo: "sin-nombre@x.co" });
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

test("POST /api/instituciones crea institución (sin admin) y luego se puede eliminar", async () => {
  const nombre = `Integración ${Date.now()}`;
  const creada = await request(app)
    .post("/api/instituciones")
    .set(auth(superToken))
    .send({ nombre, ciudad: "Medellín", departamento: "Antioquia" });
  assert.equal(creada.status, 200);
  assert.ok(creada.body.id);

  const lista = await request(app).get("/api/instituciones").set(auth(superToken));
  const encontrada = lista.body.find((i) => i.id === creada.body.id);
  assert.ok(encontrada);
  assert.equal(encontrada.nombre, nombre);
  assert.equal(encontrada.ciudad, "Medellín");

  const borrada = await request(app)
    .delete(`/api/instituciones/${creada.body.id}`)
    .set(auth(superToken));
  assert.equal(borrada.status, 200);

  const lista2 = await request(app).get("/api/instituciones").set(auth(superToken));
  assert.ok(!lista2.body.some((i) => i.id === creada.body.id));
});

test("POST /api/instituciones crea admin inicial cuando se envían sus datos", async () => {
  const sufijo = Date.now();
  const creada = await request(app)
    .post("/api/instituciones")
    .set(auth(superToken))
    .send({
      nombre: `Colegio ${sufijo}`,
      admin_nombre: "Admin Nuevo",
      admin_email: `admin${sufijo}@test.edu.co`,
      admin_password: "secreto1",
    });
  assert.equal(creada.status, 200);
  assert.ok(creada.body.id);
  assert.ok(creada.body.admin_id);

  // El admin recién creado puede iniciar sesión.
  const login = await request(app)
    .post("/api/auth/login")
    .send({ correo: `admin${sufijo}@test.edu.co`, password: "secreto1" });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  // Limpieza
  await request(app)
    .delete(`/api/instituciones/${creada.body.id}`)
    .set(auth(superToken));
});

test("PUT /api/instituciones/:id actualiza el nombre", async () => {
  const nombre = `Editar ${Date.now()}`;
  const creada = await request(app)
    .post("/api/instituciones")
    .set(auth(superToken))
    .send({ nombre });
  const nuevoNombre = `${nombre} Renombrada`;
  const res = await request(app)
    .put(`/api/instituciones/${creada.body.id}`)
    .set(auth(superToken))
    .send({ nombre: nuevoNombre });
  assert.equal(res.status, 200);

  const lista = await request(app).get("/api/instituciones").set(auth(superToken));
  const actualizada = lista.body.find((i) => i.id === creada.body.id);
  assert.equal(actualizada.nombre, nuevoNombre);

  await request(app)
    .delete(`/api/instituciones/${creada.body.id}`)
    .set(auth(superToken));
});

test("solo el superadmin puede gestionar instituciones (403 para admin y profesor)", async () => {
  const resAdmin = await request(app)
    .get("/api/instituciones")
    .set(auth(adminToken));
  assert.equal(resAdmin.status, 403);

  const resProf = await request(app)
    .post("/api/instituciones")
    .set(auth(profToken))
    .send({ nombre: "X" });
  assert.equal(resProf.status, 403);
});
