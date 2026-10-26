import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { access, unlink } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { app, teardownDB } from "../helpers/app.js";
import { login, auth, tokenAdmin } from "../helpers/auth.js";
import { pool } from "../../db.js";
import { TAMANO_MAX_ENTREGA } from "../../lib/archivosEntrega.js";

// ---------------------------------------------------------------------------
// Adjuntos de las entregas de tareas:
// - POST /api/tareas/:id/entregar acepta multipart/form-data con "archivo".
// - El enlace externo (archivo_url) sigue funcionando por compatibilidad.
// - Descarga autenticada: dueño, docente y admin de la institución.
// - Rechazo de formatos no permitidos y de archivos > 10 MB.
// - Marca de entrega tardía según la fecha límite de la tarea.
// ---------------------------------------------------------------------------

let profToken;
let estudianteToken;
let acudienteToken;
let estudianteId;
let institucionId;
let gradoId;
let materiaId;
let cursoId;
let grupoId;

const CARPETA_ENTREGAS = path.join(process.cwd(), "uploads", "entregas");
const archivosCreados = new Set();

function fechaLocal(offsetDias) {
  const d = new Date(Date.now() + offsetDias * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

before(async () => {
  const prof = await login("profesor@sia.edu.co", "prof123");
  const est = await login("estudiante@sia.edu.co", "est123");
  const acu = await login("acudiente@sia.edu.co", "acu123");
  profToken = prof.token;
  estudianteToken = est.token;
  acudienteToken = acu.token;

  const [[p]] = await pool.query(
    "SELECT id, institucion_id FROM usuarios WHERE correo = ?",
    ["profesor@sia.edu.co"],
  );
  const [[e]] = await pool.query("SELECT id FROM usuarios WHERE correo = ?", [
    "estudiante@sia.edu.co",
  ]);
  estudianteId = e.id;
  institucionId = p.institucion_id;

  const [gr] = await pool.query(
    "INSERT INTO grados (nombre, nivel, orden, institucion_id) VALUES (?, 'secundaria', 8, ?)",
    [`Grado Entregas ${Date.now()}`, institucionId],
  );
  gradoId = gr.insertId;

  const [m] = await pool.query(
    "INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)",
    ["Informática Entregas", `ENT-${Date.now()}`, gradoId, institucionId],
  );
  materiaId = m.insertId;

  const [cu] = await pool.query(
    "INSERT INTO cursos (grado_id, nombre, director_id, ano_lectivo, institucion_id) VALUES (?, 'B', ?, 2026, ?)",
    [gradoId, p.id, institucionId],
  );
  cursoId = cu.insertId;

  const [g] = await pool.query(
    "INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, institucion_id) VALUES (?, ?, ?, '2026-P1', ?)",
    [cursoId, materiaId, p.id, institucionId],
  );
  grupoId = g.insertId;

  await pool.query(
    "INSERT INTO matriculas (estudiante_id, asignacion_id, fecha_matricula, institucion_id) VALUES (?, ?, CURDATE(), ?)",
    [estudianteId, grupoId, institucionId],
  );
});

after(async () => {
  if (grupoId) {
    const [filas] = await pool.query(
      "SELECT e.archivo_ruta FROM entregas_tareas e JOIN tareas t ON t.id = e.tarea_id WHERE t.asignacion_id = ?",
      [grupoId],
    );
    for (const f of filas) if (f.archivo_ruta) archivosCreados.add(f.archivo_ruta);
    await pool.query("DELETE FROM asignaciones WHERE id = ?", [grupoId]);
  }
  if (cursoId) await pool.query("DELETE FROM cursos WHERE id = ?", [cursoId]);
  if (materiaId) await pool.query("DELETE FROM asignaturas WHERE id = ?", [materiaId]);
  if (gradoId) await pool.query("DELETE FROM grados WHERE id = ?", [gradoId]);

  for (const nombre of archivosCreados) {
    await unlink(path.join(CARPETA_ENTREGAS, path.basename(nombre))).catch(() => {});
  }
  await teardownDB();
});

async function crearTarea(offsetDias, titulo = "Tarea con adjunto") {
  const res = await request(app)
    .post("/api/tareas")
    .set(auth(profToken))
    .send({
      grupo_id: grupoId,
      titulo,
      puntaje_max: 5,
      fecha_entrega: fechaLocal(offsetDias),
    });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.id;
}

function subirArchivo(tareaId, nombre = "tarea.pdf", contenido = "%PDF-1.4 demo") {
  return request(app)
    .post(`/api/tareas/${tareaId}/entregar`)
    .set(auth(estudianteToken))
    .field("comentario", "entrega de prueba")
    .attach("archivo", Buffer.from(contenido), {
      filename: nombre,
      contentType: "application/pdf",
    });
}

async function filaEntrega(tareaId) {
  const [[fila]] = await pool.query(
    "SELECT * FROM entregas_tareas WHERE tarea_id = ? AND estudiante_id = ?",
    [tareaId, estudianteId],
  );
  return fila;
}

test("sube un archivo y guarda sus metadatos en la entrega", async () => {
  const tarea = await crearTarea(3);
  const res = await subirArchivo(tarea);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, true);
  assert.equal(res.body.tardia, false);

  const fila = await filaEntrega(tarea);
  assert.ok(fila, "la entrega debe existir");
  assert.equal(fila.archivo_nombre, "tarea.pdf");
  assert.equal(fila.archivo_mime, "application/pdf");
  assert.ok(fila.archivo_ruta.endsWith(".pdf"), fila.archivo_ruta);
  assert.ok(fila.archivo_tamano > 0);
  assert.equal(Number(fila.tardia), 0);
  archivosCreados.add(fila.archivo_ruta);
});

test("el dueño puede ver y descargar su adjunto", async () => {
  const tarea = await crearTarea(3);
  const subida = await subirArchivo(tarea);
  assert.equal(subida.status, 200, JSON.stringify(subida.body));
  const fila = await filaEntrega(tarea);
  archivosCreados.add(fila.archivo_ruta);

  const vista = await request(app)
    .get(`/api/tareas/entrega/${fila.id}/archivo`)
    .set(auth(estudianteToken));
  assert.equal(vista.status, 200);
  assert.match(vista.headers["content-type"], /application\/pdf/);
  assert.match(vista.headers["content-disposition"], /^inline;/);

  const descarga = await request(app)
    .get(`/api/tareas/entrega/${fila.id}/archivo?descargar=1`)
    .set(auth(estudianteToken));
  assert.equal(descarga.status, 200);
  assert.match(descarga.headers["content-disposition"], /^attachment;/);
  assert.match(descarga.headers["content-disposition"], /tarea\.pdf/);
});

test("el docente y el admin de la institución pueden descargar el adjunto", async () => {
  const tarea = await crearTarea(3);
  const subida = await subirArchivo(tarea);
  assert.equal(subida.status, 200, JSON.stringify(subida.body));
  const fila = await filaEntrega(tarea);
  archivosCreados.add(fila.archivo_ruta);

  const docente = await request(app)
    .get(`/api/tareas/entrega/${fila.id}/archivo`)
    .set(auth(profToken));
  assert.equal(docente.status, 200);

  const admin = await request(app)
    .get(`/api/tareas/entrega/${fila.id}/archivo`)
    .set(auth(await tokenAdmin()));
  assert.equal(admin.status, 200);
});

test("otro rol no puede descargar el adjunto", async () => {
  const tarea = await crearTarea(3);
  const subida = await subirArchivo(tarea);
  assert.equal(subida.status, 200, JSON.stringify(subida.body));
  const fila = await filaEntrega(tarea);
  archivosCreados.add(fila.archivo_ruta);

  const res = await request(app)
    .get(`/api/tareas/entrega/${fila.id}/archivo`)
    .set(auth(acudienteToken));
  assert.equal(res.status, 403);
});

test("mantiene el enlace externo como alternativa (compatibilidad)", async () => {
  const tarea = await crearTarea(3);
  const res = await request(app)
    .post(`/api/tareas/${tarea}/entregar`)
    .set(auth(estudianteToken))
    .send({ archivo_url: "https://drive.google.com/trabajo", comentario: "enlace" });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const fila = await filaEntrega(tarea);
  assert.equal(fila.archivo_url, "https://drive.google.com/trabajo");
  assert.equal(fila.archivo_ruta, null);

  const descarga = await request(app)
    .get(`/api/tareas/entrega/${fila.id}/archivo`)
    .set(auth(estudianteToken));
  assert.equal(descarga.status, 404);
});

test("marca la entrega como tardía si la fecha límite ya pasó", async () => {
  const tarea = await crearTarea(-2);
  const res = await subirArchivo(tarea);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.tardia, true);

  const fila = await filaEntrega(tarea);
  assert.equal(Number(fila.tardia), 1);
  archivosCreados.add(fila.archivo_ruta);
});

test("rechaza formatos no permitidos", async () => {
  const tarea = await crearTarea(3);
  const res = await request(app)
    .post(`/api/tareas/${tarea}/entregar`)
    .set(auth(estudianteToken))
    .attach("archivo", Buffer.from("MZ"), {
      filename: "virus.exe",
      contentType: "application/octet-stream",
    });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Formato no permitido/i);
  assert.equal(await filaEntrega(tarea), undefined);
});

test("rechaza archivos que superan los 10 MB", async () => {
  const tarea = await crearTarea(3);
  const res = await request(app)
    .post(`/api/tareas/${tarea}/entregar`)
    .set(auth(estudianteToken))
    .attach("archivo", Buffer.alloc(TAMANO_MAX_ENTREGA + 1, 1), {
      filename: "grande.pdf",
      contentType: "application/pdf",
    });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /tamaño máximo/i);
  assert.equal(await filaEntrega(tarea), undefined);
});

test("re-entregar reemplaza el archivo anterior y lo borra del disco", async () => {
  const tarea = await crearTarea(3);
  const primera = await subirArchivo(tarea, "primera.pdf");
  assert.equal(primera.status, 200, JSON.stringify(primera.body));
  const fila1 = await filaEntrega(tarea);
  const rutaAnterior = path.join(CARPETA_ENTREGAS, path.basename(fila1.archivo_ruta));

  const segunda = await subirArchivo(tarea, "segunda.pdf");
  assert.equal(segunda.status, 200, JSON.stringify(segunda.body));
  const fila2 = await filaEntrega(tarea);
  archivosCreados.add(fila2.archivo_ruta);

  assert.equal(fila2.archivo_nombre, "segunda.pdf");
  assert.notEqual(fila2.archivo_ruta, fila1.archivo_ruta);
  await assert.rejects(access(rutaAnterior), /ENOENT/);
});

test("un comentario nuevo conserva el adjunto ya entregado", async () => {
  const tarea = await crearTarea(3);
  const subida = await subirArchivo(tarea);
  assert.equal(subida.status, 200, JSON.stringify(subida.body));
  const antes = await filaEntrega(tarea);
  archivosCreados.add(antes.archivo_ruta);

  const res = await request(app)
    .post(`/api/tareas/${tarea}/entregar`)
    .set(auth(estudianteToken))
    .send({ comentario: "solo actualizo el comentario" });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const despues = await filaEntrega(tarea);
  assert.equal(despues.archivo_ruta, antes.archivo_ruta);
  assert.equal(despues.comentario, "solo actualizo el comentario");
});
