import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// ---------------------------------------------------------------------------
// Prepara la base de datos de pruebas (`academico_test` por defecto) aplicando
// las mismas migraciones que producción, pero reemplazando el nombre de la BD
// para NO tocar la base de desarrollo `academico`. Ejecuta con:
//   cross-env DB_NAME=academico_test node tests/setup-db.js
// ---------------------------------------------------------------------------

const TEST_DB = process.env.DB_NAME || "academico_test";
const MIGRACIONES = [
  "001_init.sql",
  "002_multi_tenant.sql",
  "003_institucion_logo.sql",
];

const leer = (file) =>
  fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

try {
  for (const file of MIGRACIONES) {
    let sql = leer(file);
    // Las migraciones apuntan por defecto a la BD `academico`; intercambiamos
    // el nombre por el de la BD de prueba sin modificar los archivos originales.
    sql = sql.split("academico").join(TEST_DB);
    await conn.query(sql);
    console.log(`Aplicada en ${TEST_DB}: ${file}`);
  }
  console.log(`Esquema listo en BD ${TEST_DB}.`);
} finally {
  await conn.end();
}
