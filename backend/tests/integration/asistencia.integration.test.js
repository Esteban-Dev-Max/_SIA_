import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import XLSX from "xlsx";
import { app, teardownDB } from "../helpers/app.js";
import { login, auth, tokenAdmin } from "../helpers/auth.js";
import { pool } from "../../db.js";

// ---------------------------------------------------------------------------
// Asistencia (panel del profesor):
// - Resumen histórico por grupo con semántica fallas = ausentes + tardes,
//   porcentaje sobre registros con estado, y flags en_riesgo / fallas_criticas.
// - Upsert de un registro (POST /registrar) y reflejo inmediato en el resumen.
// - Alerta por notificación a estudiantes en riesgo (POST /alerta/grupo/:id).
// - Reportes JSON + exportación xlsx/csv/pdf con los mismos datos.
// Crea su propia materia/grupo/estudiantes para no interferir con otros tests.
// ---------------------------------------------------------------------------

let profToken;
let institucionId;
let materiaId;
let grupoId;
let cursoEsperado;
let idsEstudiantes = [];

const FECHAS = ["2026-01-05", "2026-01-08", "2026-01-12"];

// asistencias: (1) B falló las 3 sesiones; (2) C lleva 1 presente y 2 tardes;
// (3) D tiene 1 presente y 1 ausente; (0) A no tiene marcas.
async function sembrarAsistencia() {
  const marcas = [
    { matricula_id: idsEstudiantes[1].matricula_id, fecha: FECHAS[0], estado: "ausente", observacion: "Sin justificar" },
    { matricula_id: idsEstudiantes[1].matricula_id, fecha: FECHAS[1], estado: "ausente", observacion: null },
    { matricula_id: idsEstudiantes[1].matricula_id, fecha: FECHAS[2], estado: "ausente", observacion: null },
    { matricula_id: idsEstudiantes[2].matricula_id, fecha: FECHAS[0], estado: "presente", observacion: null },
    { matricula_id: idsEstudiantes[2].matricula_id, fecha: FECHAS[1], estado: "tarde", observacion: "Retraso" },
    { matricula_id: idsEstudiantes[2].matricula_id, fecha: FECHAS[2], estado: "tarde", observacion: null },
    { matricula_id: idsEstudiantes[3].matricula_id, fecha: FECHAS[0], estado: "presente", observacion: null },
    { matricula_id: idsEstudiantes[3].matricula_id, fecha: FECHAS[1], estado: "ausente", observacion: null },
  ];
  for (const m of marcas) {
    await pool.query(
      "INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)",
      [m.matricula_id, m.fecha, m.estado, m.observacion],
    );
  }
  // A (índice 0): no se le marca nada -> sin registros.
}

before(async () => {
  const prof = await login("profesor@sia.edu.co", "prof123");
  profToken = prof.token;

  const [[p]] = await pool.query("SELECT id, institucion_id FROM usuarios WHERE correo = ?", [
    "profesor@sia.edu.co",
  ]);
  institucionId = p.institucion_id;

  const [gr] = await pool.query(
    "INSERT INTO grados (nombre, nivel, orden, institucion_id) VALUES (?, 'secundaria', 8, ?)",
    [`Grado Asis ${Date.now()}`, institucionId],
  );
  const gradoId = gr.insertId;

  const [m] = await pool.query(
    "INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)",
    ["Asistencia Reportes", `ASIS-${Date.now()}`, gradoId, institucionId],
  );
  materiaId = m.insertId;

  const [cu] = await pool.query(
    "INSERT INTO cursos (grado_id, nombre, director_id, ano_lectivo, institucion_id) VALUES (?, 'B', ?, 2026, ?)",
    [gradoId, p.id, institucionId],
  );
  const cursoId = cu.insertId;

  const [g] = await pool.query(
    "INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, horario, institucion_id) VALUES (?, ?, ?, '2026-P1', 'Lun 7:00-9:00', ?)",
    [cursoId, materiaId, p.id, institucionId],
  );
  grupoId = g.insertId;

  const hash = await bcrypt.hash("clave123", 10);
  const nombres = ["A SinMarcas", "B FallasX3", "C EnRiesgo", "D Medias"];
  for (const nombre of nombres) {
    const sufijo = Date.now() + Math.random().toString(16).slice(2, 8);
    const [u] = await pool.query(
      "INSERT INTO usuarios (nombre_completo, correo, `password`, rol, institucion_id) VALUES (?, ?, ?, 'estudiante', ?)",
      [`${nombre} ${sufijo}`, `asist-${sufijo}@test.sia`, hash, institucionId],
    );
    const [ma] = await pool.query(
      "INSERT INTO matriculas (estudiante_id, asignacion_id, fecha_matricula, institucion_id) VALUES (?, ?, CURDATE(), ?)",
      [u.insertId, grupoId, institucionId],
    );
    idsEstudiantes.push({ estudiante_id: u.insertId, matricula_id: ma.insertId, nombre });
  }
  await sembrarAsistencia();
  const [[grRow]] = await pool.query("SELECT nombre FROM grados WHERE id = ?", [gradoId]);
  cursoEsperado = `${grRow.nombre} B`;
});

after(async () => {
  if (grupoId) await pool.query("DELETE FROM asignaciones WHERE id = ?", [grupoId]);
  if (materiaId) await pool.query("DELETE FROM asignaturas WHERE id = ?", [materiaId]);
  await pool.query("DELETE FROM notificaciones WHERE institucion_id = ?", [institucionId]);
  if (institucionId) {
    await pool.query(
      "DELETE FROM usuarios WHERE institucion_id = ? AND correo LIKE 'asist-%@test.sia'",
      [institucionId],
    );
  }
  await teardownDB();
});

function estudianteDe(res, nombre) {
  return res.body.estudiantes.find((e) => e.estudiante.startsWith(nombre));
}

describe("resumen de asistencia por grupo", () => {
  test("GET /resumen/grupo devuelve contadores, porcentaje y flags", async () => {
    const res = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}`)
      .set(auth(profToken));
    assert.equal(res.status, 200);

    const { grupo, estudiantes } = res.body;
    assert.equal(grupo.codigo_grupo, cursoEsperado);
    assert.equal(grupo.materia, "Asistencia Reportes");
    assert.ok(grupo.institucion_nombre);

    const a = estudiantes.find((e) => e.estudiante.startsWith("A SinMarcas"));
    assert.equal(a.total, 0);
    assert.equal(a.porcentaje, null);
    assert.equal(a.en_riesgo, false);

    const b = estudiantes.find((e) => e.estudiante.startsWith("B FallasX3"));
    assert.equal(b.ausentes, 3);
    assert.equal(b.fallas, 3);
    assert.equal(b.total, 3);
    assert.equal(b.porcentaje, 0);
    assert.equal(b.en_riesgo, true);
    assert.equal(b.fallas_criticas, true);

    const c = estudiantes.find((e) => e.estudiante.startsWith("C EnRiesgo"));
    assert.equal(c.tardes, 2);
    assert.equal(c.fallas, 2);
    assert.equal(c.porcentaje, 33);
    assert.equal(c.en_riesgo, true);
    assert.equal(c.fallas_criticas, false);

    const d = estudiantes.find((e) => e.estudiante.startsWith("D Medias"));
    assert.equal(d.porcentaje, 50);
    assert.equal(d.en_riesgo, true);
  });

  test("el resumen filtra por rango de fechas", async () => {
    const res = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}?desde=2026-01-12&hasta=2026-01-12`)
      .set(auth(profToken));
    assert.equal(res.status, 200);
    const b = estudianteDe(res, "B FallasX3");
    assert.equal(b.total, 1);
    assert.equal(b.porcentaje, 0);
    // Fuera del rango: D no tiene registros ese día.
    const d = estudianteDe(res, "D Medias");
    assert.equal(d.total, 0);
  });

  test("rango inválido devuelve 400", async () => {
    const res = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}?desde=2026-05-01&hasta=2026-01-01`)
      .set(auth(profToken));
    assert.equal(res.status, 400);
  });

  test("clasifica el semáforo de riesgo (bajo/alerta/critico)", async () => {
    const res = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}`)
      .set(auth(profToken));
    assert.equal(res.status, 200);
    const a = estudianteDe(res, "A SinMarcas");
    assert.equal(a.nivel, "sin_registros");
    const b = estudianteDe(res, "B FallasX3");
    assert.equal(b.nivel, "critico");
    const c = estudianteDe(res, "C EnRiesgo");
    assert.equal(c.nivel, "critico");
    assert.equal(res.body.totales.niveles.critico, 3);
    assert.equal(res.body.totales.niveles.sin_registros, 1);
    assert.equal(res.body.totales.niveles.bajo, 0);
    assert.equal(res.body.totales.niveles.alerta, 0);
  });

  test("autorización: sin token 401 y estudiante ajeno 403", async () => {
    const sinToken = await request(app).get(`/api/asistencia/resumen/grupo/${grupoId}`);
    assert.equal(sinToken.status, 401);

    const est = await login("estudiante@sia.edu.co", "est123");
    const ajeno = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}`)
      .set(auth(est.token));
    assert.equal(ajeno.status, 403);
  });
});

describe("upsert de registros y reflejo en el resumen", () => {
  test("POST /registrar actualiza una celda y el resumen lo refleja", async () => {
    const b = idsEstudiantes[1];
    const res = await request(app)
      .post("/api/asistencia/registrar")
      .set(auth(profToken))
      .send({
        grupo_id: grupoId,
        fecha: FECHAS[1],
        justificacion: "Ajuste por auditoría",
        registros: [{ matricula_id: b.matricula_id, estado: "presente" }],
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.guardados, 1);

    const resumen = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}`)
      .set(auth(profToken));
    const fila = estudianteDe(resumen, "B FallasX3");
    assert.equal(fila.presentes, 1);
    assert.equal(fila.ausentes, 2);
    assert.equal(fila.porcentaje, 33);
    assert.equal(fila.fallas_criticas, false); // 2 fallas restantes no alcanzan el umbral

    // Restaurar la marca para no desalinear los demás tests.
    const restore = await request(app)
      .post("/api/asistencia/registrar")
      .set(auth(profToken))
      .send({
        grupo_id: grupoId,
        fecha: FECHAS[1],
        justificacion: "Restauración de prueba",
        registros: [{ matricula_id: b.matricula_id, estado: "ausente", observacion: "Sin justificar" }],
      });
    assert.equal(restore.status, 200);

    // Trazabilidad: ambas ediciones quedaron auditadas con justificación.
    const [audit] = await pool.query(
      `SELECT estado_anterior, estado_nuevo, justificacion, usuario_id
       FROM asistencia_audit
       WHERE matricula_id = ? AND fecha = ?
       ORDER BY id`,
      [b.matricula_id, FECHAS[1]],
    );
    assert.equal(audit.length, 2);
    assert.equal(audit[0].estado_anterior, "ausente");
    assert.equal(audit[0].estado_nuevo, "presente");
    assert.equal(audit[0].justificacion, "Ajuste por auditoría");
    assert.equal(audit[1].estado_nuevo, "ausente");
    assert.equal(audit[1].justificacion, "Restauración de prueba");
    assert.ok(audit.every((a) => a.usuario_id > 0));
  });

  test("editar un día anterior sin justificación devuelve 400", async () => {
    const b = idsEstudiantes[1];
    const res = await request(app)
      .post("/api/asistencia/registrar")
      .set(auth(profToken))
      .send({
        grupo_id: grupoId,
        fecha: FECHAS[0],
        registros: [{ matricula_id: b.matricula_id, estado: "presente" }],
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /justificación/i);
  });

  test("resumen/grupo devuelve el campo grupo tras el cambio", async () => {
    const res = await request(app)
      .get(`/api/asistencia/resumen/grupo/${grupoId}`)
      .set(auth(profToken));
    assert.ok(res.body.grupo?.institucion_logo !== undefined);
  });
});

describe("alerta de asistencia por notificación", () => {
  test("notifica a los estudiantes en riesgo elegidos", async () => {
    const [b, c] = [idsEstudiantes[1], idsEstudiantes[2]];
    const res = await request(app)
      .post(`/api/asistencia/alerta/grupo/${grupoId}`)
      .set(auth(profToken))
      .send({ estudiante_ids: [b.estudiante_id, c.estudiante_id] });
    assert.equal(res.status, 200);
    assert.equal(res.body.notificados, 2);

    const [filas] = await pool.query(
      "SELECT usuario_id FROM notificaciones WHERE titulo = 'Alerta de asistencia' AND usuario_id IN (?, ?)",
      [b.estudiante_id, c.estudiante_id],
    );
    assert.equal(filas.length, 2);
  });

  test("rechaza ids que no pertenecen al grupo con 400", async () => {
    const est = await login("estudiante@sia.edu.co", "est123");
    const res = await request(app)
      .post(`/api/asistencia/alerta/grupo/${grupoId}`)
      .set(auth(profToken))
      .send({ estudiante_ids: [est.user.id, idsEstudiantes[2].estudiante_id] });
    assert.equal(res.status, 400);
  });

  test("sin ids devuelve 400", async () => {
    const res = await request(app)
      .post(`/api/asistencia/alerta/grupo/${grupoId}`)
      .set(auth(profToken))
      .send({ estudiante_ids: [] });
    assert.equal(res.status, 400);
  });

  test("notifica también al acudiente vinculado", async () => {
    const acu = await login("acudiente@sia.edu.co", "acu123");
    const b = idsEstudiantes[1];
    await pool.query(
      "INSERT INTO acudiente_estudiante (acudiente_id, estudiante_id) VALUES (?, ?)",
      [acu.user.id, b.estudiante_id],
    );
    try {
      const res = await request(app)
        .post(`/api/asistencia/alerta/grupo/${grupoId}`)
        .set(auth(profToken))
        .send({ estudiante_ids: [b.estudiante_id] });
      assert.equal(res.status, 200);
      assert.equal(res.body.notificados, 1);
      const [filas] = await pool.query(
        `SELECT usuario_id FROM notificaciones
         WHERE titulo = 'Alerta de asistencia' AND usuario_id = ?`,
        [acu.user.id],
      );
      assert.equal(filas.length, 1);
    } finally {
      await pool.query(
        "DELETE FROM acudiente_estudiante WHERE acudiente_id = ? AND estudiante_id = ?",
        [acu.user.id, b.estudiante_id],
      );
      await pool.query(
        "DELETE FROM notificaciones WHERE usuario_id = ? AND titulo = 'Alerta de asistencia'",
        [acu.user.id],
      );
    }
  });
});

describe("reportes y exportación", () => {
  test("GET /reportes devuelve grupo, totales y estudiantes", async () => {
    const res = await request(app)
      .get(`/api/asistencia/reportes/grupo/${grupoId}`)
      .set(auth(profToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.totales.porcentaje_general, 25); // 3 presentes / 12 registros
    assert.equal(res.body.totales.en_riesgo, 3);
    assert.equal(res.body.totales.fallas_criticas, 1);
    assert.ok(Array.isArray(res.body.estudiantes));
  });

  test("exportar xlsx entrega un libro con las hojas Resumen y Detalle", async () => {
    const res = await request(app)
      .get(`/api/asistencia/reportes/grupo/${grupoId}/exportar?formato=xlsx`)
      .set(auth(profToken))
      .buffer(true)
      .parse((res2, cb) => {
        const data = [];
        res2.on("data", (c) => data.push(c));
        res2.on("end", () => cb(null, Buffer.concat(data)));
      });
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /spreadsheetml/);
    assert.ok(res.body instanceof Buffer);

    const libro = XLSX.read(res.body, { type: "buffer" });
    assert.ok(libro.Sheets.Resumen);
    assert.ok(libro.Sheets["Detalle de fallas"]);
    const resumen = XLSX.utils.sheet_to_json(libro.Sheets.Resumen);
    assert.ok(resumen.some((r) => String(r.Estudiante).startsWith("B FallasX3")));
    const detalle = XLSX.utils.sheet_to_json(libro.Sheets["Detalle de fallas"]);
    assert.ok(detalle.some((r) => r.Fecha === "2026-01-05" && r.Estado === "Ausente"));
  });

  test("exportar csv entrega texto plano con BOM", async () => {
    const res = await request(app)
      .get(`/api/asistencia/reportes/grupo/${grupoId}/exportar?formato=csv`)
      .set(auth(profToken));
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.ok(res.text.startsWith("\uFEFF"));
    assert.ok(res.text.includes("Estudiante"));
    assert.ok(res.text.includes("Fallas"));
  });

  test("formato no soportado devuelve 400", async () => {
    const res = await request(app)
      .get(`/api/asistencia/reportes/grupo/${grupoId}/exportar?formato=ods`)
      .set(auth(profToken));
    assert.equal(res.status, 400);
  });

  test("pdf entrega application/pdf", async () => {
    const res = await request(app)
      .get(`/api/asistencia/reportes/grupo/${grupoId}/pdf`)
      .set(auth(profToken))
      .buffer(true)
      .parse((res2, cb) => {
        const data = [];
        res2.on("data", (c) => data.push(c));
        res2.on("end", () => cb(null, Buffer.concat(data)));
      });
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /application\/pdf/);
    assert.ok(res.body instanceof Buffer);
    assert.ok(res.body.slice(0, 5).includes("%PDF"));
  });

  test("reportes exigen autorización", async () => {
    const res = await request(app).get(`/api/asistencia/reportes/grupo/${grupoId}/exportar?formato=xlsx`);
    assert.equal(res.status, 401);
  });
});

describe("panorama administrativo de riesgo", () => {
  test("solo el admin puede consultar el panorama", async () => {
    const res = await request(app).get("/api/asistencia/panorama").set(auth(profToken));
    assert.equal(res.status, 403);
  });

  test("sin token devuelve 401", async () => {
    const res = await request(app).get("/api/asistencia/panorama");
    assert.equal(res.status, 401);
  });

  test("devuelve agregados por asignación", async () => {
    const admin = await tokenAdmin();
    const res = await request(app).get("/api/asistencia/panorama").set(auth(admin));
    assert.equal(res.status, 200);
    const grupo = res.body.grupos.find((g) => g.codigo_grupo === cursoEsperado);
    assert.ok(grupo);
    assert.equal(grupo.alumnos, 4);
    assert.equal(grupo.totales.en_riesgo, 3);
    assert.ok(grupo.totales.niveles);
    assert.equal(grupo.totales.niveles.critico, 3);
    assert.equal(grupo.totales.niveles.sin_registros, 1);
  });

  test("filtra por grupo_id", async () => {
    const admin = await tokenAdmin();
    const res = await request(app)
      .get(`/api/asistencia/panorama?grupo_id=${grupoId}`)
      .set(auth(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.grupos.length, 1);
    assert.equal(res.body.grupos[0].codigo_grupo, cursoEsperado);
  });
});

describe("escaneo por carné QR / lector USB", () => {
  before(async () => {
    for (const e of idsEstudiantes) {
      await pool.query("UPDATE usuarios SET codigo_carnet = ? WHERE id = ?", [
        `TEST-${e.estudiante_id}`,
        e.estudiante_id,
      ]);
    }
  });

  test("marca presente al estudiante del carné escaneado", async () => {
    const d = idsEstudiantes[3];
    const res = await request(app)
      .post("/api/asistencia/escaneo")
      .set(auth(profToken))
      .send({
        grupo_id: grupoId,
        fecha: "2026-02-02",
        codigo_carnet: `TEST-${d.estudiante_id}`,
      });
    assert.equal(res.status, 200);
    assert.ok(res.body.estudiante.startsWith("D Medias"));
    const [[fila]] = await pool.query(
      "SELECT estado, marcado_por FROM asistencia WHERE matricula_id = ? AND fecha = ?",
      [d.matricula_id, "2026-02-02"],
    );
    assert.equal(fila.estado, "presente");
    assert.ok(fila.marcado_por > 0);
  });

  test("carné desconocido devuelve 404", async () => {
    const res = await request(app)
      .post("/api/asistencia/escaneo")
      .set(auth(profToken))
      .send({
        grupo_id: grupoId,
        fecha: "2026-02-02",
        codigo_carnet: "TEST-DESCONOCIDO",
      });
    assert.equal(res.status, 404);
  });

  test("el carné aparece en la lista del grupo", async () => {
    const res = await request(app)
      .get(`/api/asistencia/grupo/${grupoId}?fecha=2026-02-02`)
      .set(auth(profToken));
    const d = res.body.registros.find((r) => r.estudiante.startsWith("D Medias"));
    assert.equal(d.codigo_carnet, `TEST-${idsEstudiantes[3].estudiante_id}`);
    assert.equal(d.estado, "presente");
  });
});