import bcrypt from "bcryptjs";
import { pool } from "./db.js";

// ---------------------------------------------------------------------------
// SIA — Sistema Integral Académico
// Carga inicial de datos demo. Ejecutar con `npm run seed` desde backend/.
// Es idempotente: reinserta los usuarios demo (y sus datos asociados) al volver
// a ejecutarse.
// ---------------------------------------------------------------------------

const DEMO_USERS = [
  { nombre_completo: "Administrador SIA", correo: "admin@sia.edu.co", password: "admin123", rol: "admin" },
  { nombre_completo: "Profesor Demo", correo: "profesor@sia.edu.co", password: "prof123", rol: "profesor" },
  { nombre_completo: "Estudiante Demo", correo: "estudiante@sia.edu.co", password: "est123", rol: "estudiante" },
  { nombre_completo: "Acudiente Demo", correo: "acudiente@sia.edu.co", password: "acu123", rol: "acudiente" },
];

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
  await pool.query("DELETE FROM materias WHERE codigo IN (?, ?, ?)", ["SIS-101", "SIS-201", "SIS-301"]);
  await pool.query("DELETE FROM carreras_grados WHERE codigo IN (?, ?)", ["ING-SOFT", "TEC-SOL"]);
  await pool.query("DELETE FROM instituciones WHERE nombre = ?", ["Instituto Demostración SIA"]);
  log("OK", "Limpieza de datos demo previos");

  // 2) Institución.
  const institucionId = await insert(
    `INSERT INTO instituciones (nombre, correo, telefono, departamento, ciudad)
     VALUES (?, ?, ?, ?, ?)`,
    ["Instituto Demostración SIA", "info@sia.edu.co", "601 1234567", "Cundinamarca", "Bogotá"],
  );

  // 3) Usuarios demo (contraseñas encriptadas con bcrypt).
  const userIds = {};
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    userIds[u.rol] = await insert(
      `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, estado)
       VALUES (?, ?, ?, ?, 'activo')`,
      [u.nombre_completo, u.correo, hash, u.rol],
    );
  }
  log("OK", "4 usuarios demo creados con bcrypt");

  // 4) Relación acudiente -> estudiante.
  await insert(
    `INSERT INTO acudiente_estudiante (acudiente_id, estudiante_id) VALUES (?, ?)`,
    [userIds.acudiente, userIds.estudiante],
  );

  // 5) Carreras / grados.
  const ingSoftId = await insert(
    `INSERT INTO carreras_grados (nombre, codigo) VALUES (?, ?)`,
    ["Ingeniería de Software", "ING-SOFT"],
  );
  const tecSolId = await insert(
    `INSERT INTO carreras_grados (nombre, codigo) VALUES (?, ?)`,
    ["Técnico en Soluciones TI", "TEC-SOL"],
  );

  // 6) Materias.
  const matSis101 = await insert(
    `INSERT INTO materias (nombre, codigo, creditos, carrera_id) VALUES (?, ?, ?, ?)`,
    ["Sistemas de Información", "SIS-101", 3, ingSoftId],
  );
  const matFund = await insert(
    `INSERT INTO materias (nombre, codigo, creditos, carrera_id) VALUES (?, ?, ?, ?)`,
    ["Fundamentos de Programación", "SIS-201", 3, ingSoftId],
  );
  const matWeb = await insert(
    `INSERT INTO materias (nombre, codigo, creditos, carrera_id) VALUES (?, ?, ?, ?)`,
    ["Desarrollo Web", "SIS-301", 3, tecSolId],
  );

  // 7) Grupos (materia + código/ficha + profesor + periodo).
  const grupo101Id = await insert(
    `INSERT INTO grupos (materia_id, codigo_grupo, profesor_id, periodo, horario) VALUES (?, ?, ?, ?, ?)`,
    [matSis101, "1003", userIds.profesor, "2026-1", "Lun y Mie 7:00 - 9:00"],
  );
  const grupo201Id = await insert(
    `INSERT INTO grupos (materia_id, codigo_grupo, profesor_id, periodo, horario) VALUES (?, ?, ?, ?, ?)`,
    [matFund, "801", userIds.profesor, "2026-1", "Mar y Jue 9:00 - 11:00"],
  );
  const grupoWebId = await insert(
    `INSERT INTO grupos (materia_id, codigo_grupo, profesor_id, periodo, horario) VALUES (?, ?, ?, ?, ?)`,
    [matWeb, "250123", userIds.profesor, "2026-1", "Vie 14:00 - 18:00"],
  );

  // 8) Matrículas del estudiante demo.
  const matricula101 = await insert(
    `INSERT INTO matriculas (estudiante_id, grupo_id, fecha_matricula) VALUES (?, ?, ?)`,
    [userIds.estudiante, grupo101Id, "2026-01-20"],
  );
  const matricula201 = await insert(
    `INSERT INTO matriculas (estudiante_id, grupo_id, fecha_matricula) VALUES (?, ?, ?)`,
    [userIds.estudiante, grupo201Id, "2026-01-20"],
  );

  // 9) Notas (ponderación 25/25/20/30).
  const definitiva = (a, b, c, d) => Number((a * 0.25 + b * 0.25 + c * 0.2 + d * 0.3).toFixed(2));
  await insert(
    `INSERT INTO notas (matricula_id, nota_1, nota_2, nota_3, examen_final, nota_definitiva, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matricula101, 4.0, 3.5, 4.5, 4.0, definitiva(4.0, 3.5, 4.5, 4.0), "Buen desempeño"],
  );
  await insert(
    `INSERT INTO notas (matricula_id, nota_1, nota_2, nota_3, examen_final, nota_definitiva, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matricula201, 3.0, 2.5, 3.0, 3.0, definitiva(3.0, 2.5, 3.0, 3.0), "Presenta dificultades"],
  );

  // 10) Asistencia para las matrículas.
  await insert(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`,
    [matricula101, "2026-02-02", "presente", null],
  );
  await insert(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`,
    [matricula101, "2026-02-04", "tarde", "Llegó 10 min tarde"],
  );
  await insert(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`,
    [matricula201, "2026-02-03", "ausente", "Sin justificación"],
  );

  // 11) Tareas y entrega de ejemplo.
  const tareaId = await insert(
    `INSERT INTO tareas (grupo_id, titulo, descripcion, fecha_entrega, puntaje_max)
     VALUES (?, ?, ?, ?, ?)`,
    [grupo101Id, "Taller 1: Modelo relacional", "Diseñar el modelo entidad-relación del sistema", "2026-02-28 23:59:00", 10],
  );
  await insert(
    `INSERT INTO entregas_tareas (tarea_id, estudiante_id, archivo_url, calificacion, comentario)
     VALUES (?, ?, ?, ?, ?)`,
    [tareaId, userIds.estudiante, "https://storage.sia.edu.co/demo/taller1.pdf", 9.0, "Muy completo"],
  );

  // 12) Evento de calendario de ejemplo.
  await insert(
    `INSERT INTO eventos_calendario (titulo, descripcion, fecha_inicio, fecha_fin, tipo, curso_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["Parcial de Sistemas de Información", "Evaluación del primer corte", "2026-03-15 07:00:00", "2026-03-15 09:00:00", "evaluacion", ingSoftId],
  );

  // 13) Mensaje de ejemplo acudiente -> estudiante.
  await insert(
    `INSERT INTO mensajes (remitente_id, destinatario_id, contenido, leido) VALUES (?, ?, ?, ?)`,
    [userIds.acudiente, userIds.estudiante, "Hijo, ya revisé tus notas del primer corte. Felicitaciones.", 0],
  );
  await insert(
    `INSERT INTO mensajes (remitente_id, destinatario_id, contenido, leido) VALUES (?, ?, ?, ?)`,
    [userIds.profesor, userIds.estudiante, "Te espero en la tutoría del jueves para repasar el examen.", 0],
  );

  // 14) Notificaciones demo para el estudiante.
  await insert(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida) VALUES (?, ?, ?, ?, ?)`,
    [userIds.estudiante, "Nueva calificación", "Tu nota de Sistemas de Información se publicó: 4.0", "nota", 0],
  );
  await insert(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida) VALUES (?, ?, ?, ?, ?)`,
    [userIds.estudiante, "Tarea próxima a vencer", "Taller 1: Modelo relacional vence el 28 de febrero", "tarea", 0],
  );
  await insert(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, leida) VALUES (?, ?, ?, ?, ?)`,
    [userIds.profesor, "Nuevo mensaje", "Recibiste un mensaje de un acudiente", "mensaje", 0],
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