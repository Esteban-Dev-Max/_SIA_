import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const sql = fs.readFileSync(
  path.join(process.cwd(), "migrations", "001_init.sql"),
  "utf8",
);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

await conn.query(sql);
console.log("Migración aplicada.");
await conn.end();
