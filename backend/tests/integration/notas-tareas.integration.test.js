import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { login, auth } from "../helpers/auth.js";
import { pool } from "../../db.js";

// ---------------------------------------------------------------------------
// Sincronización Tareas → Planilla de Notas:
// - Calificar una entrega reescala la nota a 0.0–5.0 y la escribe en el
//   casillero (columna_nota) de la tarea.
// - Varias tareas en el mismo casillero se promedian.
// - La planilla manual no puede pisar columnas gestionadas por tareas.
// - Las tareas sin columna_nota no tocan la planilla.
// Crea su propia materia/grupo/matrícula para no interferir con otros tests.
// ---------------------------------------------------------------------------

let profToken;
let estudianteToken;
let estudianteId;
let institucionId;
let materiaId;
let grupoId;
let matriculaId;

before(async () => {
  const prof = await login("profesor@sia.edu.co", "prof123");
  const est = await login("estudiante@sia.edu.co", "est123");
  profToken = prof.token;
  estudianteToken = est.token;

  const [[p]] = await pool.query(
    "SELECT id, institucion_id FROM usuarios WHERE correo = ?",
    ["profesor@sia.edu.co"],
  );
  const [[e]] = await pool.query(
    "SELECT id FROM usuarios WHERE correo = ?",
    ["estudiante@sia.edu.co"],
  );
  const idProf = p.id;
  estudianteId = e.id;
  institucionId = p.institucion_id;

  const [m] = await pool.query(
    "INSERT INTO materias (nombre, codigo, creditos, institucion_id) VALUES (?, ?, 0, ?)",
    ["Matemáticas Sincronización", `MAT-SYNC-${Date.now()}`, institucionId],
  );
  materiaId = m.insertId;

  const [g] = await pool.query(
    "INSERT INTO grupos (materia_id, codigo_grupo, profesor_id, periodo, institucion_id) VALUES (?, ?, ?, '2026-1', ?)",
    [materiaId, "SYNC-1", idProf, institucionId],
  );
  grupoId = g.insertId;

  const [mat] = await pool.query(
    "INSERT INTO matriculas (estudiante_id, grupo_id, fecha_matricula, institucion_id) VALUES (?, ?, CURDATE(), ?)",
    [estudianteId, grupoId, institucionId],
  );
  matriculaId = mat.insertId;
});

after(async () => {
  if (materiaId) {
    await pool.query("DELETE FROM materias WHERE id = ?", [materiaId]);
  }
  if (estudianteId) {
    await pool.query(
      "DELETE FROM notificaciones WHERE usuario_id = ? AND titulo = ?",
      [estudianteId, "Nota actualizada desde tareas"],
    );
  }
  await teardownDB();
});

async function crearTarea(columna) {
  const res = await request(app)
    .post("/api/tareas")
    .set(auth(profToken))
    .send({
      grupo_id: grupoId,
      titulo: "Tarea sync",
      puntaje_max: 10,
      columna_nota: columna,
    });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.id;
}

async function entregar(tareaId) {
  const res = await request(app)
    .post(`/api/tareas/${tareaId}/entregar`)
    .set(auth(estudianteToken))
    .send({ archivo_url: "https://storage.test.edu/tarea.pdf", comentario: "ok" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [[e]] = await pool.query(
    "SELECT id FROM entregas_tareas WHERE tarea_id = ? AND estudiante_id = ?",
    [tareaId, estudianteId],
  );
  assert.ok(e, "la entrega debe existir");
  return e.id;
}

async function calificar(entregaId, calificacion) {
  const res = await request(app)
    .post(`/api/tareas/calificar/${entregaId}`)
    .set(auth(profToken))
    .send({ calificacion, retroalimentacion: "bien" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

async function notaActual(campo = "nota_1") {
  const [[n]] = await pool.query(
    `SELECT ${campo} AS valor, nota_definitiva FROM notas WHERE matricula_id = ?`,
    [matriculaId],
  );
  return n
    ? { valor: n.valor, definitiva: n.nota_definitiva }
    : { valor: null, definitiva: null };
}

test("crear tarea con casillero inválido devuelve 400", async () => {
  const res = await request(app)
    .post("/api/tareas")
    .set(auth(profToken))
    .send({ grupo_id: grupoId, titulo: "Mal", puntaje_max: 10, columna_nota: "rubro_9" });
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

test("calificar una tarea vinculada actualiza el casillero y notifica al estudiante", async () => {
  const tarea = await crearTarea("nota_1");
  const entrega = await entregar(tarea);
  await calificar(entrega, 9);

  const n = await notaActual();
  assert.equal(n.valor, 4.5, "9/10 reescalado = 4.5");
  assert.equal(n.definitiva, null, "sin las 4 notas no hay definitiva");

  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM notificaciones WHERE usuario_id = ? AND titulo = ?",
    [estudianteId, "Nota actualizada desde tareas"],
  );
  assert.equal(c, 1);
});

test("recalificar sobreescribe el casillero", async () => {
  const [[{ entrega_id: entrega }]] = await pool.query(
    "SELECT e.id AS entrega_id FROM entregas_tareas e JOIN tareas t ON t.id = e.tarea_id WHERE e.estudiante_id = ? AND t.columna_nota = 'nota_1' ORDER BY e.id DESC LIMIT 1",
    [estudianteId],
  );
  await calificar(entrega, 5);
  const n = await notaActual();
  assert.equal(n.valor, 2.5, "5/10 = 2.5");
});

test("guardar planilla no pisa el casillero gestionado por tareas", async () => {
  const res = await request(app)
    .post("/api/notas/guardar")
    .set(auth(profToken))
    .send({ matricula_id: matriculaId, nota_1: 4.0, nota_2: 3.5 });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const n = await notaActual();
  assert.equal(n.valor, 2.5, "nota_1 sigue siendo el valor de tareas (no 4.0)");
  const [[r]] = await pool.query(
    "SELECT nota_2 FROM notas WHERE matricula_id = ?",
    [matriculaId],
  );
  assert.equal(r.nota_2, 3.5, "nota_2 manual sí se guarda");
});

test("dos tareas en el mismo casillero se promedian", async () => {
  const tarea = await crearTarea("nota_1");
  const entrega = await entregar(tarea);
  await calificar(entrega, 10); // 10/10 -> 5.0

  // Promedio: (2.5 + 5.0) / 2 = 3.75
  const n = await notaActual();
  assert.equal(n.valor, 3.75);
});

test("tarea sin casillero no toca la planilla", async () => {
  const tarea = await crearTarea(null);
  const entrega = await entregar(tarea);
  await calificar(entrega, 8);

  const n = await notaActual();
  assert.equal(n.valor, 3.75, "se conserva el promedio de las tareas vinculadas");
});

test("borrar la última calificación del casillero lo vacía a null", async () => {
  const [[{ entrega_id: eB }]] = await pool.query(
    "SELECT e.id AS entrega_id FROM entregas_tareas e JOIN tareas t ON t.id = e.tarea_id WHERE e.estudiante_id = ? AND t.columna_nota = 'nota_1' ORDER BY t.id DESC LIMIT 1",
    [estudianteId],
  );
  await calificar(eB, null);
  const n1 = await notaActual();
  assert.equal(n1.valor, 2.5, "queda la nota de la primera tarea");

  const [[{ entrega_id: eA }]] = await pool.query(
    "SELECT e.id AS entrega_id FROM entregas_tareas e JOIN tareas t ON t.id = e.tarea_id WHERE e.estudiante_id = ? AND t.columna_nota = 'nota_1' ORDER BY t.id ASC LIMIT 1",
    [estudianteId],
  );
  await calificar(eA, null);
  const n = await notaActual();
  assert.equal(n.valor, null, "sin entregas calificadas el casillero se vacía");
});

test("GET planilla del grupo reporta las columnas gestionadas por tareas", async () => {
  const res = await request(app)
    .get(`/api/notas/grupo/${grupoId}`)
    .set(auth(profToken));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.columnas_tareas, ["nota_1"]);
  assert.ok(Array.isArray(res.body.filas));
});