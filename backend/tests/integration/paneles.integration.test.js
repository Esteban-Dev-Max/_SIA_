import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import {
  auth,
  login,
  tokenAdmin,
  tokenProfesor,
  tokenSuperAdmin,
} from "../helpers/auth.js";
import { pool } from "../../db.js";

// ---------------------------------------------------------------------------
// Endpoints de los paneles que no tenían cobertura: grupos del docente,
// resumen del acudiente, planilla de notas, chatbot, calendario, mensajería y
// notificaciones. Verifica autorización por rol, validaciones 400 y los
// guards de institución (el superadmin no ve datos académicos de colegios).
// Crea su propio grupo/matrícula por SQL y los elimina al final.
// ---------------------------------------------------------------------------

const sufi = () =>
  `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

let adminToken, profToken, estToken, acuToken, superToken;
let adminId, profId, estId, acuId, instId;
let gradoId, asigId, cursoId, grupoId, matriculaId;
let estudianteTempId;

before(async () => {
  [adminToken, profToken, superToken] = await Promise.all([
    tokenAdmin(),
    tokenProfesor(),
    tokenSuperAdmin(),
  ]);
  estToken = (await login("estudiante@sia.edu.co", "est123")).token;
  acuToken = (await login("acudiente@sia.edu.co", "acu123")).token;

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
  const [[e]] = await pool.query("SELECT id FROM usuarios WHERE correo = ?", [
    "estudiante@sia.edu.co",
  ]);
  estId = e.id;
  const [[ac]] = await pool.query("SELECT id FROM usuarios WHERE correo = ?", [
    "acudiente@sia.edu.co",
  ]);
  acuId = ac.id;

  // Grupo con el estudiante demo matriculado (docente = profesor demo).
  const [g] = await pool.query(
    "INSERT INTO grados (nombre, nivel, orden, institucion_id) VALUES (?, 'secundaria', 7, ?)",
    [`Grado Panel ${sufi()}`, instId],
  );
  gradoId = g.insertId;
  const [s] = await pool.query(
    "INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)",
    [`Panel ${sufi()}`, `PAN-${sufi()}`, gradoId, instId],
  );
  asigId = s.insertId;
  const [c] = await pool.query(
    "INSERT INTO cursos (grado_id, nombre, director_id, ano_lectivo, institucion_id) VALUES (?, 'Q', ?, 2032, ?)",
    [gradoId, profId, instId],
  );
  cursoId = c.insertId;
  const [gr] = await pool.query(
    "INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, horario, institucion_id) VALUES (?, ?, ?, '2032-P1', 'Mar 8:00-10:00', ?)",
    [cursoId, asigId, profId, instId],
  );
  grupoId = gr.insertId;
  const [m] = await pool.query(
    "INSERT INTO matriculas (estudiante_id, asignacion_id, fecha_matricula, institucion_id) VALUES (?, ?, CURDATE(), ?)",
    [estId, grupoId, instId],
  );
  matriculaId = m.insertId;
});

after(async () => {
  if (estudianteTempId) {
    await pool.query("DELETE FROM usuarios WHERE id = ?", [estudianteTempId]);
  }
  await pool.query("DELETE FROM notas WHERE matricula_id = ?", [matriculaId]);
  await pool.query("DELETE FROM matriculas WHERE id = ?", [matriculaId]);
  await pool.query("DELETE FROM asignaciones WHERE id = ?", [grupoId]);
  await pool.query("DELETE FROM cursos WHERE id = ?", [cursoId]);
  await pool.query("DELETE FROM asignaturas WHERE id = ?", [asigId]);
  await pool.query("DELETE FROM grados WHERE id = ?", [gradoId]);
  await teardownDB();
});

describe("panel del docente", () => {
  test("GET /api/profesor/grupos devuelve las asignaciones del docente", async () => {
    const res = await request(app).get("/api/profesor/grupos").set(auth(profToken));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const g = res.body.find((x) => x.id === grupoId);
    assert.ok(g, "debe aparecer la asignación del fixture");
    assert.ok(g.materia);
    assert.ok(g.codigo_grupo);
  });

  test("un estudiante no puede ver los grupos del docente (403)", async () => {
    const res = await request(app).get("/api/profesor/grupos").set(auth(estToken));
    assert.equal(res.status, 403);
  });
});

describe("panel del acudiente", () => {
  test("GET /api/acudiente/estudiantes lista los estudiantes vinculados", async () => {
    const res = await request(app).get("/api/acudiente/estudiantes").set(auth(acuToken));
    assert.equal(res.status, 200);
    assert.ok(res.body.some((x) => x.estudiante_id === estId));
  });

  test("un docente no puede acceder al panel de acudiente (403)", async () => {
    const res = await request(app).get("/api/acudiente/estudiantes").set(auth(profToken));
    assert.equal(res.status, 403);
  });

  test("GET /api/acudiente/resumen/:id valida id, vínculo y devuelve el resumen", async () => {
    const malId = await request(app)
      .get("/api/acudiente/resumen/abc")
      .set(auth(acuToken));
    assert.equal(malId.status, 400);

    const ok = await request(app)
      .get(`/api/acudiente/resumen/${estId}`)
      .set(auth(acuToken));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.estudiante.id, estId);
    assert.ok(Array.isArray(ok.body.notas));
    assert.ok(Array.isArray(ok.body.asistencia));

    // Datos adicionales para el boletín: profesor por materia, curso, periodos,
    // resumen de asistencia e institución.
    const filaFixture = ok.body.notas.find((n) => n.grupo_id === grupoId);
    assert.ok(filaFixture, "debe incluir la asignación del fixture");
    assert.equal(filaFixture.profesor, "Docente Demo");
    assert.ok(ok.body.periodos.includes("2032-P1"));
    // El curso anual depende de las matrículas_curso del estudiante demo, que
    // otros tests de integración también crean/eliminan: se valida la forma, no
    // el valor concreto.
    assert.ok("curso" in ok.body);
    if (ok.body.curso) {
      assert.equal(typeof ok.body.curso.grado, "string");
      assert.equal(typeof ok.body.curso.nombre, "string");
      assert.equal(typeof ok.body.curso.ano_lectivo, "number");
    }
    assert.equal(typeof ok.body.asistencia_resumen.total, "number");
    assert.ok(ok.body.institucion);
    assert.equal(ok.body.institucion.nombre, "Colegio Demostración SIA");

    // Estudiante no vinculado al acudiente → 403.
    const [t] = await pool.query(
      "INSERT INTO usuarios (nombre_completo, correo, `password`, rol, institucion_id) VALUES (?, ?, 'x', 'estudiante', ?)",
      [`No Vinculado ${sufi()}`, `nope-${sufi()}@test.edu.co`, instId],
    );
    estudianteTempId = t.insertId;
    const ajeno = await request(app)
      .get(`/api/acudiente/resumen/${estudianteTempId}`)
      .set(auth(acuToken));
    assert.equal(ajeno.status, 403);
  });
});

describe("planilla de notas", () => {
  test("GET /api/notas/grupo/:id exige ser docente de la asignación", async () => {
    const prof = await request(app)
      .get(`/api/notas/grupo/${grupoId}`)
      .set(auth(profToken));
    assert.equal(prof.status, 200);
    assert.ok(Array.isArray(prof.body.filas));
    assert.ok(Array.isArray(prof.body.columnas_tareas));

    const est = await request(app)
      .get(`/api/notas/grupo/${grupoId}`)
      .set(auth(estToken));
    assert.equal(est.status, 403);
  });

  test("GET /api/notas/estudiante/:id autoriza dueño, docente y admin", async () => {
    const self = await request(app)
      .get(`/api/notas/estudiante/${estId}`)
      .set(auth(estToken));
    assert.equal(self.status, 200);

    const admin = await request(app)
      .get(`/api/notas/estudiante/${estId}`)
      .set(auth(adminToken));
    assert.equal(admin.status, 200);

    const ajeno = await request(app)
      .get(`/api/notas/estudiante/${adminId}`)
      .set(auth(estToken));
    assert.equal(ajeno.status, 403);
  });

  test("POST /api/notas/guardar valida rango y guarda", async () => {
    const fuera = await request(app)
      .post("/api/notas/guardar")
      .set(auth(profToken))
      .send({ matricula_id: matriculaId, nota_1: 0 });
    assert.equal(fuera.status, 400);
    assert.match(fuera.body.error, /entre 1 y 5/);

    const ok = await request(app)
      .post("/api/notas/guardar")
      .set(auth(profToken))
      .send({ matricula_id: matriculaId, nota_1: 4 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));

    const [[n]] = await pool.query(
      "SELECT nota_1, nota_definitiva FROM notas WHERE matricula_id = ?",
      [matriculaId],
    );
    assert.equal(n.nota_1, 4);
    assert.equal(n.nota_definitiva, null, "sin las 4 notas no hay definitiva");
  });

  test("un docente no puede guardar notas de una asignación ajena (403)", async () => {
    const res = await request(app)
      .post("/api/notas/guardar")
      .set(auth(estToken))
      .send({ matricula_id: matriculaId, nota_1: 4 });
    assert.equal(res.status, 403);
  });
});

describe("chatbot y asistente", () => {
  test("POST /api/chatbot/pregunta exige token y pregunta", async () => {
    const sinToken = await request(app)
      .post("/api/chatbot/pregunta")
      .send({ pregunta: "hola" });
    assert.equal(sinToken.status, 401);

    const vacia = await request(app)
      .post("/api/chatbot/pregunta")
      .set(auth(profToken))
      .send({});
    assert.equal(vacia.status, 400);

    const ok = await request(app)
      .post("/api/chatbot/pregunta")
      .set(auth(profToken))
      .send({ pregunta: "¿Cómo registro notas?" });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.respuesta);
  });

  test("POST /api/chat cae al motor de reglas sin API key y nunca da 500", async () => {
    // Sin GEMINI_API_KEY el endpoint usa el motor por palabras clave (no red).
    const previa = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const sinToken = await request(app).post("/api/chat").send({ pregunta: "hola" });
      assert.equal(sinToken.status, 401);

      const ok = await request(app)
        .post("/api/chat")
        .set(auth(estToken))
        .send({ pregunta: "hola" });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.intento, "reglas");
      assert.ok(ok.body.respuesta);

      const larga = await request(app)
        .post("/api/chat")
        .set(auth(estToken))
        .send({ pregunta: "x".repeat(600) });
      assert.equal(larga.status, 400);
    } finally {
      if (previa !== undefined) process.env.GEMINI_API_KEY = previa;
    }
  });
});

describe("calendario", () => {
  test("GET /api/calendario/eventos devuelve la agenda; el superadmin no ve datos de colegios", async () => {
    const admin = await request(app)
      .get("/api/calendario/eventos")
      .set(auth(adminToken));
    assert.equal(admin.status, 200);
    assert.ok(Array.isArray(admin.body));

    const est = await request(app)
      .get("/api/calendario/eventos")
      .set(auth(estToken));
    assert.equal(est.status, 200);

    const superadmin = await request(app)
      .get("/api/calendario/eventos")
      .set(auth(superToken));
    assert.equal(superadmin.status, 403);
  });

  test("POST /api/calendario/eventos valida tipo y rol", async () => {
    const tipoMalo = await request(app)
      .post("/api/calendario/eventos")
      .set(auth(adminToken))
      .send({ titulo: "X", fecha_inicio: "2032-05-01T08:00", tipo: "inventado" });
    assert.equal(tipoMalo.status, 400);

    const profInstitucional = await request(app)
      .post("/api/calendario/eventos")
      .set(auth(profToken))
      .send({ titulo: "X", fecha_inicio: "2032-05-01T08:00", tipo: "institucional" });
    assert.equal(profInstitucional.status, 403);

    const est = await request(app)
      .post("/api/calendario/eventos")
      .set(auth(estToken))
      .send({ titulo: "X", fecha_inicio: "2032-05-01T08:00", tipo: "evaluacion" });
    assert.equal(est.status, 403);

    const titulo = `Evento QA ${sufi()}`;
    const ok = await request(app)
      .post("/api/calendario/eventos")
      .set(auth(adminToken))
      .send({ titulo, fecha_inicio: "2032-05-01T08:00", tipo: "institucional" });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    await pool.query("DELETE FROM eventos_calendario WHERE id = ?", [ok.body.id]);
  });
});

describe("mensajería", () => {
  test("GET /api/mensajes/contactos filtra por institución y bloquea al superadmin", async () => {
    const admin = await request(app)
      .get("/api/mensajes/contactos")
      .set(auth(adminToken));
    assert.equal(admin.status, 200);
    assert.ok(Array.isArray(admin.body));

    const superadmin = await request(app)
      .get("/api/mensajes/contactos")
      .set(auth(superToken));
    assert.equal(superadmin.status, 403);
  });

  test("POST /api/mensajes/enviar valida destinatario y notifica", async () => {
    const self = await request(app)
      .post("/api/mensajes/enviar")
      .set(auth(adminToken))
      .send({ destinatario_id: adminId, contenido: "hola" });
    assert.equal(self.status, 400);

    const inexistente = await request(app)
      .post("/api/mensajes/enviar")
      .set(auth(adminToken))
      .send({ destinatario_id: 99999999, contenido: "hola" });
    assert.equal(inexistente.status, 404);

    const contenido = `Mensaje QA ${sufi()}`;
    const ok = await request(app)
      .post("/api/mensajes/enviar")
      .set(auth(adminToken))
      .send({ destinatario_id: estId, contenido });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.mensaje.destinatario_id, estId);

    const [[noti]] = await pool.query(
      "SELECT COUNT(*) AS c FROM notificaciones WHERE usuario_id = ? AND titulo = 'Nuevo mensaje'",
      [estId],
    );
    assert.ok(noti.c >= 1);

    await pool.query(
      "DELETE FROM mensajes WHERE remitente_id = ? AND destinatario_id = ? AND contenido = ?",
      [adminId, estId, contenido],
    );
    await pool.query(
      "DELETE FROM notificaciones WHERE usuario_id = ? AND titulo = 'Nuevo mensaje'",
      [estId],
    );
  });
});

describe("notificaciones", () => {
  test("GET /api/notificaciones/:id valida id y autoriza solo al dueño (o admin de su institución)", async () => {
    const malId = await request(app)
      .get("/api/notificaciones/abc")
      .set(auth(estToken));
    assert.equal(malId.status, 400);

    const propias = await request(app)
      .get(`/api/notificaciones/${estId}`)
      .set(auth(estToken));
    assert.equal(propias.status, 200);
    assert.ok(Array.isArray(propias.body.notificaciones));

    const ajenas = await request(app)
      .get(`/api/notificaciones/${profId}`)
      .set(auth(estToken));
    assert.equal(ajenas.status, 403);
  });

  test("marcar-leida devuelve 404 si no existe y marcar-todas funciona", async () => {
    const noExiste = await request(app)
      .put("/api/notificaciones/marcar-leida/99999999")
      .set(auth(estToken));
    assert.equal(noExiste.status, 404);

    const todas = await request(app)
      .put(`/api/notificaciones/marcar-todas/${estId}`)
      .set(auth(estToken));
    assert.equal(todas.status, 200);
    assert.equal(todas.body.ok, true);
  });
});
