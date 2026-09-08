import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const leer = (file) =>
  fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8");

// Migraciones en orden. 001 crea el esquema base, 002 aplica el soporte
// multi-tenant (institucion_id, rol superadmin, estado en instituciones),
// 003 agrega logo_url a instituciones para branding multi-tenant y
// 004 crea password_resets para la recuperación de contraseña.
const migraciones = [
  "001_init.sql",
  "002_multi_tenant.sql",
  "003_institucion_logo.sql",
  "004_password_reset.sql",
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
