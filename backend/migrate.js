import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const leer = (file) =>
  fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8");

// Migraciones en orden. 001 crea el esquema base, 002 aplica el soporte
// multi-tenant (institucion_id, rol superadmin, estado en instituciones),
// 003 agrega logo_url a instituciones para branding multi-tenant,
// 004 crea password_resets para la recuperación de contraseña,
// 005 vincula tareas con la planilla de notas (columna_nota) y
// 006 agrega trazabilidad/auditoría a la asistencia (codigo_carnet,
// marcado_por, hora_marcado y la bitácora asistencia_audit),
// 007 elimina la columna creditos de materias (función retirada),
// 008 adapta el modelo de instituto al de colegio (grados, asignaturas,
// cursos, asignaciones y matrícula anual),
// 009 agrega los adjuntos y la marca de entrega tardía en entregas_tareas.
const migraciones = [
  "001_init.sql",
  "002_multi_tenant.sql",
  "003_institucion_logo.sql",
  "004_password_reset.sql",
  "005_tareas_columna_nota.sql",
  "006_trazabilidad_asistencia.sql",
  "007_quitar_creditos.sql",
  "008_colegios.sql",
  "009_entregas_archivo.sql",
];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

for (const file of migraciones) {
  const sql = leer(file);
  await conn.query(sql);
  console.log(`Aplicada: ${file}`);
}
console.log("Migración aplicada.");
await conn.end();
