import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "../db.js";
dotenv.config();

// ---------------------------------------------------------------------------
// Siembra datos demo en la BD de PRUEBAS (no en `academico` de desarrollo).
// Requiere que ya exista el esquema (ver tests/setup-db.js). Debe ejecutarse
// con DB_NAME=academico_test (lo hace el script "test:integration").
// Idempotente: borra los usuarios demo previos antes de reinsertarlos.
// ---------------------------------------------------------------------------

const DEMO_USERS = [
  { nombre_completo: "Super Admin SIA", correo: "superadmin@sia.edu.co", password: "superadmin123", rol: "superadmin", institucion_id: null },
  { nombre_completo: "Administrador SIA", correo: "admin@sia.edu.co", password: "admin123", rol: "admin" },
  { nombre_completo: "Profesor Demo", correo: "profesor@sia.edu.co", password: "prof123", rol: "profesor" },
  { nombre_completo: "Estudiante Demo", correo: "estudiante@sia.edu.co", password: "est123", rol: "estudiante" },
  { nombre_completo: "Acudiente Demo", correo: "acudiente@sia.edu.co", password: "acu123", rol: "acudiente" },
];

async function insert(sql, params = []) {
  const [res] = await pool.query(sql, params);
  return res.insertId;
}

async function main() {
  // Limpieza de datos demo previos para reutilizar el seed.
  for (const u of DEMO_USERS) {
    await pool.query("DELETE FROM usuarios WHERE correo = ?", [u.correo]);
  }
  await pool.query("DELETE FROM instituciones WHERE nombre = ?", ["Instituto Demostración SIA"]);

  // Institución demo.
  const institucionId = await insert(
    `INSERT INTO instituciones (nombre, correo, telefono, departamento, ciudad, estado)
     VALUES (?, ?, ?, ?, ?, 'activo')`,
    ["Instituto Demostración SIA", "info@sia.edu.co", "601 1234567", "Cundinamarca", "Bogotá"],
  );

  // Usuarios demo con bcrypt.
  const userIds = {};
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const instId = u.rol === "superadmin" ? null : institucionId;
    userIds[u.rol] = await insert(
      `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, estado, institucion_id)
       VALUES (?, ?, ?, ?, 'activo', ?)`,
      [u.nombre_completo, u.correo, hash, u.rol, instId],
    );
  }

  // Relación acudiente -> estudiante (necesaria para algunas consultas).
  await insert(
    "INSERT INTO acudiente_estudiante (acudiente_id, estudiante_id) VALUES (?, ?)",
    [userIds.acudiente, userIds.estudiante],
  );

  console.log("Datos demo sembrados en BD de pruebas.");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.rol.padEnd(9)}  ${u.correo}  /  ${u.password}`);
  }
}

await main()
  .then(() => console.log("\nSeed de pruebas completado."))
  .catch((err) => {
    console.error("Error en el seed de pruebas:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
