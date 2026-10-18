import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { calcularDefinitiva } from "./lib/notas.js";

// ---------------------------------------------------------------------------
// SIA — Sistema Integral Académico (colegios)
// Carga inicial de datos demo. Ejecutar con `npm run seed` desde backend/.
// Es idempotente: reinserta los usuarios demo (y sus datos asociados) al volver
// a ejecutarse.
// ---------------------------------------------------------------------------

const DEMO_USERS = [
  { nombre_completo: "Super Admin SIA", correo: "superadmin@sia.edu.co", password: "superadmin123", rol: "superadmin", institucion_id: null },
  { nombre_completo: "Administrador SIA", correo: "admin@sia.edu.co", password: "admin123", rol: "admin" },
  { nombre_completo: "Docente Demo", correo: "profesor@sia.edu.co", password: "prof123", rol: "profesor" },
  { nombre_completo: "Estudiante Demo", correo: "estudiante@sia.edu.co", password: "est123", rol: "estudiante" },
  { nombre_completo: "Acudiente Demo", correo: "acudiente@sia.edu.co", password: "acu123", rol: "acudiente" },
];

const INSTITUCION_DEMO = "Colegio Demostración SIA";
const ANO_LECTIVO = 2026;
const PERIODO_DEMO = "2026-P1";

async function insert(sql, params = []) {
  const [res] = await pool.query(sql, params);
  return res.insertId;
}

async function log(ok, msg) {
  console.log(`${ok ? "OK" : "!OK"}  ${msg}`);
}

async function main() {
  // 1) Limpiar datos demo previos para reutilizar el seed.
  for (const u of DEMO_USERS) {
    await pool.query("DELETE FROM usuarios WHERE correo = ?", [u.correo]);
  }
  await pool.query("DELETE FROM asignaturas WHERE codigo IN (?, ?, ?, ?)", ["MAT-6", "LEN-6", "CIE-6", "ING-6"]);
  await pool.query("DELETE FROM grados WHERE nombre IN (?, ?)", ["Sexto", "Séptimo"]);
  await pool.query("DELETE FROM instituciones WHERE nombre = ?", [INSTITUCION_DEMO]);
  log("OK", "Limpieza de datos demo previos");

  // 2) Institución.
  const institucionId = await insert(
    `INSERT INTO instituciones (nombre, correo, telefono, departamento, ciudad)
     VALUES (?, ?, ?, ?, ?)`,
    [INSTITUCION_DEMO, "info@colegiodemo.edu.co", "601 1234567", "Cundinamarca", "Bogotá"],
  );

  // 3) Usuarios demo (contraseñas encriptadas con bcrypt).
  // El superadmin NO pertenece a ninguna institución (institucion_id = NULL);
  // el resto de usuarios se vincula a la institución demo.
const userIds = {};
    for (const u of DEMO_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const instId = u.rol === "superadmin" ? null : institucionId;
      const id = await insert(
        `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, estado, institucion_id)
         VALUES (?, ?, ?, ?, 'activo', ?)`,
        [u.nombre_completo, u.correo, hash, u.rol, instId],
      );
      if (u.rol === "estudiante") {
        await pool.query("UPDATE usuarios SET codigo_carnet = ? WHERE id = ?", [
          `EST-${String(id).padStart(5, "0")}`,
          id,
        ]);
      }
      userIds[u.rol] = id;
    }
    log("OK", "5 usuarios demo creados con bcrypt");

  // 4) Relación acudiente -> estudiante.
  await insert(
    `INSERT INTO acudiente_estudiante (acudiente_id, estudiante_id) VALUES (?, ?)`,
    [userIds.acudiente, userIds.estudiante],
  );

  // 5) Grados.
  const sextoId = await insert(
    `INSERT INTO grados (nombre, nivel, orden, institucion_id) VALUES (?, ?, ?, ?)`,
    ["Sexto", "secundaria", 6, institucionId],
  );
  const septimoId = await insert(
    `INSERT INTO grados (nombre, nivel, orden, institucion_id) VALUES (?, ?, ?, ?)`,
    ["Séptimo", "secundaria", 7, institucionId],
  );

  // 6) Asignaturas de sexto.
  const matId = await insert(
    `INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)`,
    ["Matemáticas", "MAT-6", sextoId, institucionId],
  );
  const lenId = await insert(
    `INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)`,
    ["Lengua Castellana", "LEN-6", sextoId, institucionId],
  );
  const ingId = await insert(
    `INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)`,
    ["Inglés", "ING-6", sextoId, institucionId],
  );
  await insert(
    `INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)`,
    ["Ciencias Naturales", "CIE-6", sextoId, institucionId],
  );
  void septimoId;

  // 7) Curso 6A (con el docente demo como director) y sus asignaciones P1.
  const curso6A = await insert(
    `INSERT INTO cursos (grado_id, nombre, director_id, ano_lectivo, institucion_id) VALUES (?, ?, ?, ?, ?)`,
    [sextoId, "A", userIds.profesor, ANO_LECTIVO, institucionId],
  );
  const asigMat = await insert(
    `INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, horario, institucion_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [curso6A, matId, userIds.profesor, PERIODO_DEMO, "Lun y Mié 7:00 - 8:00", institucionId],
  );
  const asigLen = await insert(
    `INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, horario, institucion_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [curso6A, lenId, userIds.profesor, PERIODO_DEMO, "Mar y Jue 8:00 - 9:00", institucionId],
  );
  await insert(
    `INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, horario, institucion_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [curso6A, ingId, userIds.profesor, PERIODO_DEMO, "Vie 7:00 - 9:00", institucionId],
  );

  // 8) Matrícula anual del estudiante demo a 6A (+ herencia de asignaturas).
  await insert(
    `INSERT INTO matriculas_curso (estudiante_id, curso_id, ano_lectivo, fecha_matricula, institucion_id) VALUES (?, ?, ?, ?, ?)`,
    [userIds.estudiante, curso6A, ANO_LECTIVO, "2026-01-20", institucionId],
  );
  const matriculaMat = await insert(
    `INSERT INTO matriculas (estudiante_id, asignacion_id, fecha_matricula, institucion_id) VALUES (?, ?, ?, ?)`,
    [userIds.estudiante, asigMat, "2026-01-20", institucionId],
  );
  const matriculaLen = await insert(
    `INSERT INTO matriculas (estudiante_id, asignacion_id, fecha_matricula, institucion_id) VALUES (?, ?, ?, ?)`,
    [userIds.estudiante, asigLen, "2026-01-20", institucionId],
  );

  // 9) Notas (ponderación única definida en lib/notas.js).
  await insert(
    `INSERT INTO notas (matricula_id, nota_1, nota_2, nota_3, examen_final, nota_definitiva, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      matriculaMat,
      4.0,
      3.5,
      4.5,
      4.0,
      calcularDefinitiva({ nota_1: 4.0, nota_2: 3.5, nota_3: 4.5, examen_final: 4.0 }),
      "Buen desempeño",
    ],
  );
  await insert(
    `INSERT INTO notas (matricula_id, nota_1, nota_2, nota_3, examen_final, nota_definitiva, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      matriculaLen,
      3.0,
      2.5,
      3.0,
      3.0,
      calcularDefinitiva({ nota_1: 3.0, nota_2: 2.5, nota_3: 3.0, examen_final: 3.0 }),
      "Debe reforzar lectura",
    ],
  );

  // 10) Asistencia para las matrículas.
  await insert(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`,
    [matriculaMat, "2026-02-02", "presente", null],
  );
  await insert(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`,
    [matriculaMat, "2026-02-04", "tarde", "Llegó 10 min tarde"],
  );
  await insert(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`,
    [matriculaLen, "2026-02-03", "ausente", "Sin justificación"],
  );

  // 11) Tareas y entrega de ejemplo.
  const tareaId = await insert(
    `INSERT INTO tareas (asignacion_id, titulo, descripcion, fecha_entrega, puntaje_max, institucion_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [asigMat, "Taller 1: Fracciones", "Resolver los ejercicios 1 al 20 de la guía", "2026-02-28 23:59:00", 10, institucionId],
  );
  await insert(
    `INSERT INTO entregas_tareas (tarea_id, estudiante_id, archivo_url, calificacion, comentario)
     VALUES (?, ?, ?, ?, ?)`,
    [tareaId, userIds.estudiante, "https://storage.sia.edu.co/demo/taller1.pdf", 9.0, "Muy completo"],
  );

  // 12) Evento de calendario de ejemplo.
  await insert(
    `INSERT INTO eventos_calendario (titulo, descripcion, fecha_inicio, fecha_fin, tipo, curso_id, institucion_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["Evaluación de Matemáticas", "Evaluación del primer periodo", "2026-03-15 07:00:00", "2026-03-15 09:00:00", "evaluacion", sextoId, institucionId],
  );

  // 13) Mensaje de ejemplo acudiente -> estudiante.
  await insert(
    `INSERT INTO mensajes (remitente_id, destinatario_id, contenido, leido, institucion_id) VALUES (?, ?, ?, ?, ?)`,
    [userIds.acudiente, userIds.estudiante, "Hijo, ya revisé tus notas del primer periodo. Felicitaciones.", 0, institucionId],
  );
  await insert(
    `INSERT INTO mensajes (remitente_id, destinatario_id, contenido, leido, institucion_id) VALUES (?, ?, ?, ?, ?)`,
    [userIds.profesor, userIds.estudiante, "Te espero en la tutoría del jueves para repasar la evaluación.", 0, institucionId],
  );

  // 14) Notificaciones demo para el estudiante.
  await insert(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida, institucion_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [userIds.estudiante, "Nueva calificación", "Tu nota de Matemáticas se publicó: 4.0", "nota", 0, institucionId],
  );
  await insert(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida, institucion_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [userIds.estudiante, "Tarea próxima a vencer", "Taller 1: Fracciones vence el 28 de febrero", "tarea", 0, institucionId],
  );
  await insert(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida, institucion_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [userIds.profesor, "Nuevo mensaje", "Recibiste un mensaje de un acudiente", "mensaje", 0, institucionId],
  );

  console.log("---");
  console.log("Usuarios demo:");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.rol.padEnd(9)}  ${u.correo}  /  ${u.password}`);
  }
}

await main()
  .then(() => console.log("\nSeed completado."))
  .catch((err) => {
    console.error("Error en el seed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
