import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const users = [
  { nombre: "Admin", email: "admin@demo.com", password: "admin123", rol: "admin" },
  { nombre: "Profesor Uno", email: "profe@demo.com", password: "profe123", rol: "profesor" },
  { nombre: "Estudiante Uno", email: "alumno@demo.com", password: "alumno123", rol: "estudiante" },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 10);
  await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), password_hash = VALUES(password_hash), rol = VALUES(rol)`,
    [u.nombre, u.email, hash, u.rol],
  );
  console.log("Seed:", u.email, "/", u.password);
}

await pool.end();
