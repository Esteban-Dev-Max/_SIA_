import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { auth, login, tokenAdmin, tokenSuperAdmin } from "../helpers/auth.js";
import { pool } from "../../db.js";

// ---------------------------------------------------------------------------
// CRUD administrativo (grados, asignaturas, cursos, asignaciones, matrículas,
// vínculos acudiente-estudiante y usuarios) + aislamiento multi-tenant.
// Cubre los códigos de estado (200/400/403/404) y los dos arreglos de esta
// auditoría: PUT /api/admin/usuarios/:id devuelve 404 si no existe y la
// paginación tolera un page_size inválido (antes un negativo daba 500).
// Crea datos con sufijo único y los limpia al final para no chocar con otros
// archivos de test que corren en paralelo.
// ---------------------------------------------------------------------------

const sufi = () =>
  `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

let adminToken;
let instId;
let profId;
let estId;
let acuId;
let adminId;

const creados = {
  grados: [],
  asignaturas: [],
  cursos: [],
  asignaciones: [],
  usuarios: [],
};

async function del(sql, params) {
  if (params.length) await pool.query(sql, params);
}

before(async () => {
  adminToken = await tokenAdmin();
  const [[a]] = await pool.query(
    "SELECT id, institucion_id FROM usuarios WHERE correo = ?",
    ["admin@sia.edu.co"],
  );
  adminId = a.id;
  instId = a.institucion_id;
  const [[p]] = await pool.query("SELECT id FROM usuarios WHERE correo = ?", [
    "profesor@sia.edu.co",
  ]);
  profId = p.id;
  const est = await login("estudiante@sia.edu.co", "est123");
  estId = est.user.id;
  const [[ac]] = await pool.query("SELECT id FROM usuarios WHERE correo = ?", [
    "acudiente@sia.edu.co",
  ]);
  acuId = ac.id;
});

after(async () => {
  // El orden respeta las claves foráneas (hijas primero).
  if (creados.usuarios.length) {
    await del(
      `DELETE FROM usuarios WHERE id IN (${creados.usuarios.map(() => "?").join(",")})`,
      creados.usuarios,
    );
  }
  if (creados.cursos.length) {
    await del(
      `DELETE FROM cursos WHERE id IN (${creados.cursos.map(() => "?").join(",")})`,
      creados.cursos,
    );
  }
  if (creados.asignaciones.length) {
    await del(
      `DELETE FROM asignaciones WHERE id IN (${creados.asignaciones.map(() => "?").join(",")})`,
      creados.asignaciones,
    );
  }
  if (creados.asignaturas.length) {
    await del(
      `DELETE FROM asignaturas WHERE id IN (${creados.asignaturas.map(() => "?").join(",")})`,
      creados.asignaturas,
    );
  }
  if (creados.grados.length) {
    await del(
      `DELETE FROM grados WHERE id IN (${creados.grados.map(() => "?").join(",")})`,
      creados.grados,
    );
  }
  await teardownDB();
});

async function crearGrado() {
  const res = await request(app)
    .post("/api/admin/grados")
    .set(auth(adminToken))
    .send({ nombre: `Grado QA ${sufi()}`, nivel: "secundaria", orden: 9 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  creados.grados.push(res.body.id);
  return res.body.id;
}

async function crearCurso(gradoId) {
  const res = await request(app)
    .post("/api/admin/cursos")
    .set(auth(adminToken))
    .send({ grado_id: gradoId, nombre: "Z", director_id: profId, ano_lectivo: 2031 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  creados.cursos.push(res.body.id);
  return res.body.id;
}

async function crearAsignacion(cursoId, asignaturaId) {
  const res = await request(app)
    .post("/api/admin/asignaciones")
    .set(auth(adminToken))
    .send({
      curso_id: cursoId,
      asignatura_id: asignaturaId,
      docente_id: profId,
      periodo: "2031-P1",
      horario: "Lun 7:00-9:00",
    });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  creados.asignaciones.push(res.body.id);
  return res.body.id;
}

describe("grados", () => {
  test("POST sin nivel devuelve 400", async () => {
    const res = await request(app)
      .post("/api/admin/grados")
      .set(auth(adminToken))
      .send({ nombre: "Sin nivel" });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test("POST, PUT y DELETE funcionan; PUT/DELETE de inexistente dan 404", async () => {
    const id = await crearGrado();
    const put = await request(app)
      .put(`/api/admin/grados/${id}`)
      .set(auth(adminToken))
      .send({ nombre: `Grado QA editado ${sufi()}`, nivel: "media", orden: 10 });
    assert.equal(put.status, 200);
    assert.equal(put.body.nivel, "media");

    const put404 = await request(app)
      .put("/api/admin/grados/99999999")
      .set(auth(adminToken))
      .send({ nombre: "Nope", nivel: "media", orden: 1 });
    assert.equal(put404.status, 404);

    const del404 = await request(app)
      .delete("/api/admin/grados/99999999")
      .set(auth(adminToken));
    assert.equal(del404.status, 404);

    const del = await request(app)
      .delete(`/api/admin/grados/${id}`)
      .set(auth(adminToken));
    assert.equal(del.status, 200);
    creados.grados = creados.grados.filter((x) => x !== id);
  });
});

describe("asignaturas", () => {
  test("POST con grado inexistente devuelve 400", async () => {
    const res = await request(app)
      .post("/api/admin/asignaturas")
      .set(auth(adminToken))
      .send({ nombre: "Fantasma", grado_id: 99999999 });
    assert.equal(res.status, 400);
  });

  test("POST, PUT y DELETE funcionan", async () => {
    const gradoId = await crearGrado();
    const post = await request(app)
      .post("/api/admin/asignaturas")
      .set(auth(adminToken))
      .send({ nombre: `Asignatura QA ${sufi()}`, codigo: `QA-${sufi()}`, grado_id: gradoId });
    assert.equal(post.status, 200, JSON.stringify(post.body));
    creados.asignaturas.push(post.body.id);

    const put = await request(app)
      .put(`/api/admin/asignaturas/${post.body.id}`)
      .set(auth(adminToken))
      .send({ nombre: `Asignatura QA editada ${sufi()}`, codigo: `QA-${sufi()}`, grado_id: gradoId });
    assert.equal(put.status, 200);
    assert.equal(put.body.grado_id, gradoId);

    const del = await request(app)
      .delete(`/api/admin/asignaturas/${post.body.id}`)
      .set(auth(adminToken));
    assert.equal(del.status, 200);
    creados.asignaturas = creados.asignaturas.filter((x) => x !== post.body.id);
  });
});

describe("cursos", () => {
  test("POST sin año lectivo válido devuelve 400", async () => {
    const gradoId = await crearGrado();
    const res = await request(app)
      .post("/api/admin/cursos")
      .set(auth(adminToken))
      .send({ grado_id: gradoId, nombre: "A", ano_lectivo: 1990 });
    assert.equal(res.status, 400);
  });

  test("POST ok y PUT de inexistente da 404", async () => {
    const gradoId = await crearGrado();
    await crearCurso(gradoId);
    const put404 = await request(app)
      .put("/api/admin/cursos/99999999")
      .set(auth(adminToken))
      .send({ nombre: "A", ano_lectivo: 2031 });
    assert.equal(put404.status, 404);
  });
});

describe("asignaciones", () => {
  test("POST con periodo semestral viejo (2031-1) devuelve 400", async () => {
    const gradoId = await crearGrado();
    const cursoId = await crearCurso(gradoId);
    const [asig] = await pool.query(
      "INSERT INTO asignaturas (nombre, institucion_id) VALUES (?, ?)",
      [`Asig QA ${sufi()}`, instId],
    );
    creados.asignaturas.push(asig.insertId);
    const res = await request(app)
      .post("/api/admin/asignaciones")
      .set(auth(adminToken))
      .send({
        curso_id: cursoId,
        asignatura_id: asig.insertId,
        docente_id: profId,
        periodo: "2031-1",
      });
    assert.equal(res.status, 400);
  });

  test("POST ok y PUT de inexistente da 404", async () => {
    const gradoId = await crearGrado();
    const cursoId = await crearCurso(gradoId);
    const [asig] = await pool.query(
      "INSERT INTO asignaturas (nombre, institucion_id) VALUES (?, ?)",
      [`Asig QA ${sufi()}`, instId],
    );
    creados.asignaturas.push(asig.insertId);
    await crearAsignacion(cursoId, asig.insertId);
    const put404 = await request(app)
      .put("/api/admin/asignaciones/99999999")
      .set(auth(adminToken))
      .send({ docente_id: profId, periodo: "2031-P1" });
    assert.equal(put404.status, 404);
  });
});

describe("matrículas", () => {
  test("POST con estudiante inexistente da 400 y DELETE de inexistente 404", async () => {
    const gradoId = await crearGrado();
    const cursoId = await crearCurso(gradoId);
    const post = await request(app)
      .post("/api/admin/matriculas")
      .set(auth(adminToken))
      .send({ estudiante_id: 99999999, curso_id: cursoId });
    assert.equal(post.status, 400);

    const del404 = await request(app)
      .delete("/api/admin/matriculas/99999999")
      .set(auth(adminToken));
    assert.equal(del404.status, 404);
  });

  test("POST ok, duplicado da 400 y DELETE ok", async () => {
    const gradoId = await crearGrado();
    const cursoId = await crearCurso(gradoId);
    const post = await request(app)
      .post("/api/admin/matriculas")
      .set(auth(adminToken))
      .send({ estudiante_id: estId, curso_id: cursoId });
    assert.equal(post.status, 200, JSON.stringify(post.body));

    const dup = await request(app)
      .post("/api/admin/matriculas")
      .set(auth(adminToken))
      .send({ estudiante_id: estId, curso_id: cursoId });
    assert.equal(dup.status, 400);

    // Extra: la matrícula anual debe reflejarse en el listado.
    const lista = await request(app)
      .get("/api/admin/matriculas")
      .set(auth(adminToken));
    assert.equal(lista.status, 200);
    assert.ok(lista.body.some((m) => m.id === post.body.id));

    const del = await request(app)
      .delete(`/api/admin/matriculas/${post.body.id}`)
      .set(auth(adminToken));
    assert.equal(del.status, 200);
  });
});

describe("vinculación acudiente-estudiante", () => {
  test("POST con acudiente inexistente da 400 y DELETE de inexistente 404", async () => {
    const post = await request(app)
      .post("/api/admin/vincular-acudiente")
      .set(auth(adminToken))
      .send({ acudiente_id: 99999999, estudiante_id: estId });
    assert.equal(post.status, 400);

    const del404 = await request(app)
      .delete("/api/admin/vincular-acudiente/99999999")
      .set(auth(adminToken));
    assert.equal(del404.status, 404);
  });

  test("POST ok, duplicado da 400 y DELETE ok", async () => {
    // Estudiante nuevo para no chocar con el vínculo del seed.
    const crear = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({
        nombre_completo: `Vinculado QA ${sufi()}`,
        correo: `vinc-${sufi()}@test.edu.co`,
        password: "clave123",
        rol: "estudiante",
      });
    assert.equal(crear.status, 200);
    creados.usuarios.push(crear.body.id);

    const post = await request(app)
      .post("/api/admin/vincular-acudiente")
      .set(auth(adminToken))
      .send({ acudiente_id: acuId, estudiante_id: crear.body.id });
    assert.equal(post.status, 200, JSON.stringify(post.body));

    const dup = await request(app)
      .post("/api/admin/vincular-acudiente")
      .set(auth(adminToken))
      .send({ acudiente_id: acuId, estudiante_id: crear.body.id });
    assert.equal(dup.status, 400);

    const del = await request(app)
      .delete(`/api/admin/vincular-acudiente/${post.body.id}`)
      .set(auth(adminToken));
    assert.equal(del.status, 200);
  });
});

describe("usuarios del admin", () => {
  test("POST valida campos y rol", async () => {
    const sinDatos = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({ correo: "x@x.co" });
    assert.equal(sinDatos.status, 400);

    const rolMalo = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({
        nombre_completo: "QA",
        correo: `rol-${sufi()}@test.edu.co`,
        password: "clave123",
        rol: "superadmin",
      });
    assert.equal(rolMalo.status, 400);

    const corta = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({
        nombre_completo: "QA",
        correo: `corta-${sufi()}@test.edu.co`,
        password: "123",
        rol: "estudiante",
      });
    assert.equal(corta.status, 400);
  });

  test("POST crea usuario y asigna carné al estudiante; correo duplicado da 400", async () => {
    const correo = `nuevo-${sufi()}@test.edu.co`;
    const res = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({ nombre_completo: "Nuevo Estudiante", correo, password: "clave123", rol: "estudiante" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    creados.usuarios.push(res.body.id);

    const [[u]] = await pool.query("SELECT codigo_carnet FROM usuarios WHERE id = ?", [res.body.id]);
    assert.ok(u.codigo_carnet, "el estudiante debe tener carné");

    const dup = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({ nombre_completo: "Otro", correo, password: "clave123", rol: "estudiante" });
    assert.equal(dup.status, 400);
    assert.match(dup.body.error, /registrado/i);
  });

  test("PUT de un usuario inexistente devuelve 404 (no 200)", async () => {
    const res = await request(app)
      .put("/api/admin/usuarios/99999999")
      .set(auth(adminToken))
      .field("nombre_completo", "Fantasma");
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  test("PUT actualiza un usuario existente", async () => {
    const correo = `put-${sufi()}@test.edu.co`;
    const crear = await request(app)
      .post("/api/admin/usuarios")
      .set(auth(adminToken))
      .send({ nombre_completo: "Antes", correo, password: "clave123", rol: "estudiante" });
    assert.equal(crear.status, 200);
    creados.usuarios.push(crear.body.id);

    const put = await request(app)
      .put(`/api/admin/usuarios/${crear.body.id}`)
      .set(auth(adminToken))
      .field("estado", "inactivo");
    assert.equal(put.status, 200, JSON.stringify(put.body));

    const [[u]] = await pool.query("SELECT estado FROM usuarios WHERE id = ?", [crear.body.id]);
    assert.equal(u.estado, "inactivo");
  });

  test("la paginación tolera page_size inválido sin devolver 500", async () => {
    const negativo = await request(app)
      .get("/api/admin/usuarios?page=1&page_size=-5")
      .set(auth(adminToken));
    assert.equal(negativo.status, 200);
    assert.ok(Array.isArray(negativo.body.items));
    assert.equal(negativo.body.page, 1);

    const cero = await request(app)
      .get("/api/admin/usuarios?page=1&page_size=0")
      .set(auth(adminToken));
    assert.equal(cero.status, 200);
    assert.equal(cero.body.page_size, 50);
  });

  test("GET filtra por rol", async () => {
    const res = await request(app)
      .get("/api/admin/usuarios?rol=profesor")
      .set(auth(adminToken));
    assert.equal(res.status, 200);
    assert.ok(res.body.every((u) => u.rol === "profesor"));
  });

  test("un docente no puede listar usuarios del admin (403)", async () => {
    const prof = await login("profesor@sia.edu.co", "prof123");
    const res = await request(app)
      .get("/api/admin/usuarios")
      .set(auth(prof.token));
    assert.equal(res.status, 403);
  });
});

describe("aislamiento multi-tenant", () => {
  test("un admin no ve ni edita datos de otra institución", async () => {
    const superToken = await tokenSuperAdmin();
    const s = sufi();
    const correoAdminB = `adminb-${s}@test.edu.co`;
    const creada = await request(app)
      .post("/api/instituciones")
      .set(auth(superToken))
      .send({
        nombre: `Colegio B ${s}`,
        admin_nombre: "Admin B",
        admin_email: correoAdminB,
        admin_password: "clave123",
      });
    assert.equal(creada.status, 200, JSON.stringify(creada.body));
    const instB = creada.body.id;
    const adminBId = creada.body.admin_id;

    try {
      const loginB = await login(correoAdminB, "clave123");
      const tokenB = loginB.token;

      const gB = await request(app)
        .post("/api/admin/grados")
        .set(auth(tokenB))
        .send({ nombre: `Grado B ${s}`, nivel: "primaria", orden: 1 });
      assert.equal(gB.status, 200);
      const gradoBId = gB.body.id;

      // El admin A no ve el grado de B.
      const listaA = await request(app).get("/api/admin/grados").set(auth(adminToken));
      assert.ok(!listaA.body.some((g) => g.id === gradoBId));

      // El admin A no puede editarlo ni borrarlo (404).
      const editA = await request(app)
        .put(`/api/admin/grados/${gradoBId}`)
        .set(auth(adminToken))
        .send({ nombre: "Hack", nivel: "primaria", orden: 1 });
      assert.equal(editA.status, 404);

      const delA = await request(app)
        .delete(`/api/admin/grados/${gradoBId}`)
        .set(auth(adminToken));
      assert.equal(delA.status, 404);

      // El admin A no puede leer usuarios de B por notificaciones ajenas.
      const noti = await request(app)
        .get(`/api/notificaciones/${adminBId}`)
        .set(auth(adminToken));
      assert.equal(noti.status, 403);
    } finally {
      await request(app).delete(`/api/instituciones/${instB}`).set(auth(superToken));
      // La FK deja al admin B con institucion_id NULL; se elimina explícitamente.
      await pool.query("DELETE FROM usuarios WHERE id = ?", [adminBId]);
    }
  });
});
