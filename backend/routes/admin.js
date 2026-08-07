import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken, requireRole("admin"));

const ROLES = ["admin", "profesor", "estudiante", "acudiente"];

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- Dashboard: métricas globales ----------
r.get("/stats", asyncHandler(async (_req, res) => {
  const [[{ estudiantes }]] = await pool.query(
    "SELECT COUNT(*) AS estudiantes FROM usuarios WHERE rol = 'estudiante'",
  );
  const [[{ profesores }]] = await pool.query(
    "SELECT COUNT(*) AS profesores FROM usuarios WHERE rol = 'profesor' AND estado = 'activo'",
  );
  const [[{ materias }]] = await pool.query("SELECT COUNT(*) AS materias FROM materias");
  const [[{ grupos }]] = await pool.query("SELECT COUNT(*) AS grupos FROM grupos");
  const [[{ matriculas }]] = await pool.query("SELECT COUNT(*) AS matriculas FROM matriculas");
  const [[{ carreras }]] = await pool.query("SELECT COUNT(*) AS carreras FROM carreras_grados");
  const [[{ acudientes }]] = await pool.query(
    "SELECT COUNT(*) AS acudientes FROM usuarios WHERE rol = 'acudiente' AND estado = 'activo'",
  );
  res.json({ estudiantes, profesores, materias, grupos, matriculas, carreras, acudientes });
}));

// ---------- Usuarios ----------
r.get("/usuarios", asyncHandler(async (req, res) => {
  const { rol, q } = req.query;
  const conds = [];
  const params = [];
  if (rol && ROLES.includes(String(rol))) {
    conds.push("rol = ?");
    params.push(String(rol));
  }
  if (q && String(q).trim()) {
    conds.push("(nombre_completo LIKE ? OR correo LIKE ?)");
    const term = `%${String(q).trim()}%`;
    params.push(term, term);
  }
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
  const [rows] = await pool.query(
    `SELECT id, nombre_completo, correo, rol, estado, foto_url, fecha_creacion
     FROM usuarios ${where}
     ORDER BY fecha_creacion DESC, id DESC`,
    params,
  );
  res.json(rows);
}));

r.post("/usuarios", asyncHandler(async (req, res) => {
  const { nombre_completo, correo, password, rol, foto_url } = req.body;
  if (!nombre_completo || !correo || !password || !rol) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  if (!ROLES.includes(rol)) return res.status(400).json({ error: "Rol inválido" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, foto_url)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre_completo.trim(), correo.trim().toLowerCase(), hash, rol, foto_url ?? null],
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }
    throw e;
  }
}));

r.put("/usuarios/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const { nombre_completo, correo, rol, estado, password, foto_url } = req.body;
  if (estado !== undefined && !["activo", "inactivo"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  const sets = [];
  const params = [];
  if (nombre_completo !== undefined) {
    sets.push("nombre_completo = ?");
    params.push(nombre_completo.trim());
  }
  if (correo !== undefined) {
    sets.push("correo = ?");
    params.push(correo.trim().toLowerCase());
  }
  if (rol !== undefined) {
    if (!ROLES.includes(rol)) return res.status(400).json({ error: "Rol inválido" });
    sets.push("rol = ?");
    params.push(rol);
  }
  if (estado !== undefined) {
    sets.push("estado = ?");
    params.push(estado);
  }
  if (foto_url !== undefined) {
    sets.push("foto_url = ?");
    params.push(foto_url || null);
  }
  if (password) {
    sets.push("`password` = ?");
    params.push(await bcrypt.hash(password, 10));
  }
  if (sets.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
  params.push(id);
  try {
    await pool.query(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = ?`, params);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }
    throw e;
  }
  res.json({ ok: true });
}));

// ---------- Carreras / grados ----------
r.get("/carreras", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM carreras_grados ORDER BY nombre");
  res.json(rows);
}));

r.post("/carreras", asyncHandler(async (req, res) => {
  const { nombre, codigo } = req.body;
  if (!nombre) return res.status(400).json({ error: "Faltan datos" });
  const code =
    codigo?.trim() || nombre.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  try {
    const [result] = await pool.query(
      "INSERT INTO carreras_grados (nombre, codigo) VALUES (?, ?)",
      [nombre.trim(), code],
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "El código ya existe" });
    throw e;
  }
}));

r.put("/carreras/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const { nombre, codigo } = req.body;
  if (!nombre || !codigo) return res.status(400).json({ error: "Faltan datos" });
  const [result] = await pool.query(
    "UPDATE carreras_grados SET nombre = ?, codigo = ? WHERE id = ?",
    [nombre.trim(), codigo.trim(), id],
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: "Carrera no encontrada" });
  res.json({ ok: true });
}));

r.delete("/carreras/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const [result] = await pool.query("DELETE FROM carreras_grados WHERE id = ?", [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: "Carrera no encontrada" });
  res.json({ ok: true });
}));

// ---------- Materias ----------
r.get("/materias", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.nombre, m.codigo, m.creditos, m.carrera_id, c.nombre AS carrera_nombre
     FROM materias m
     LEFT JOIN carreras_grados c ON c.id = m.carrera_id
     ORDER BY m.nombre`,
  );
  res.json(rows);
}));

r.post("/materias", asyncHandler(async (req, res) => {
  const { nombre, codigo, creditos, carrera_id } = req.body;
  if (!nombre || !codigo) return res.status(400).json({ error: "Faltan datos" });
  try {
    const [result] = await pool.query(
      `INSERT INTO materias (nombre, codigo, creditos, carrera_id) VALUES (?, ?, ?, ?)`,
      [
        nombre.trim(),
        codigo.trim().toUpperCase(),
        Number(creditos) || 0,
        carrera_id ? Number(carrera_id) : null,
      ],
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "El código ya existe" });
    throw e;
  }
}));

r.put("/materias/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const { nombre, codigo, creditos, carrera_id } = req.body;
  if (!nombre || !codigo) return res.status(400).json({ error: "Faltan datos" });
  const [result] = await pool.query(
    `UPDATE materias SET nombre = ?, codigo = ?, creditos = ?, carrera_id = ? WHERE id = ?`,
    [
      nombre.trim(),
      codigo.trim().toUpperCase(),
      Number(creditos) || 0,
      carrera_id ? Number(carrera_id) : null,
      id,
    ],
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: "Materia no encontrada" });
  res.json({ ok: true });
}));

r.delete("/materias/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const [result] = await pool.query("DELETE FROM materias WHERE id = ?", [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: "Materia no encontrada" });
  res.json({ ok: true });
}));

// ---------- Grupos (materia + código/ficha + profesor + periodo) ----------
r.get("/grupos", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT g.id, g.codigo_grupo, g.periodo, g.horario,
            m.nombre AS materia, m.codigo AS materia_codigo,
            u.id AS profesor_id, u.nombre_completo AS profesor,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.grupo_id = g.id) AS alumnos
     FROM grupos g
     JOIN materias m ON m.id = g.materia_id
     LEFT JOIN usuarios u ON u.id = g.profesor_id
     ORDER BY m.nombre, g.codigo_grupo`,
  );
  res.json(rows);
}));

r.post("/grupos", asyncHandler(async (req, res) => {
  const { materia_id, codigo_grupo, profesor_id, periodo, horario } = req.body;
  const materiaId = parseId(materia_id);
  const profesorId = parseId(profesor_id);
  const codigo = typeof codigo_grupo === "string" ? codigo_grupo.trim() : "";
  if (!materiaId || !profesorId || !codigo || !periodo) {
    return res.status(400).json({ error: "Faltan datos (código/ficha del grupo obligatorio)" });
  }
  const [result] = await pool.query(
    "INSERT INTO grupos (materia_id, codigo_grupo, profesor_id, periodo, horario) VALUES (?, ?, ?, ?, ?)",
    [materiaId, codigo, profesorId, String(periodo), horario ?? null],
  );
  res.json({ ok: true, id: result.insertId });
}));

r.delete("/grupos/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const [result] = await pool.query("DELETE FROM grupos WHERE id = ?", [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: "Grupo no encontrado" });
  res.json({ ok: true });
}));

// ---------- Matrículas ----------
r.get("/matriculas", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT mat.id, mat.estudiante_id, u.nombre_completo AS estudiante, u.correo,
            g.id AS grupo_id, g.codigo_grupo, m.nombre AS materia, g.periodo, mat.fecha_matricula
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     ORDER BY mat.id DESC`,
  );
  res.json(rows);
}));

r.post("/matriculas", asyncHandler(async (req, res) => {
  const { estudiante_id, grupo_id, fecha_matricula } = req.body;
  const estudianteId = parseId(estudiante_id);
  const grupoId = parseId(grupo_id);
  if (!estudianteId || !grupoId) return res.status(400).json({ error: "Faltan datos" });
  try {
    const [result] = await pool.query(
      `INSERT INTO matriculas (estudiante_id, grupo_id, fecha_matricula) VALUES (?, ?, ?)`,
      [
        estudianteId,
        grupoId,
        fecha_matricula ?? new Date().toISOString().slice(0, 10),
      ],
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "El estudiante ya está matriculado en ese grupo" });
    }
    throw e;
  }
}));

r.delete("/matriculas/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const [result] = await pool.query("DELETE FROM matriculas WHERE id = ?", [id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "Matrícula no encontrada" });
  }
  res.json({ ok: true });
}));

// ---------- Vincular acudiente con estudiante ----------
r.post("/vincular-acudiente", asyncHandler(async (req, res) => {
  const { acudiente_id, estudiante_id } = req.body;
  if (!acudiente_id || !estudiante_id) return res.status(400).json({ error: "Faltan datos" });
  const [[acu]] = await pool.query(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'acudiente'",
    [Number(acudiente_id)],
  );
  if (!acu) return res.status(400).json({ error: "El acudiente no existe" });
  const [[est]] = await pool.query(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'estudiante'",
    [Number(estudiante_id)],
  );
  if (!est) return res.status(400).json({ error: "El estudiante no existe" });
  try {
    const [result] = await pool.query(
      "INSERT INTO acudiente_estudiante (acudiente_id, estudiante_id) VALUES (?, ?)",
      [Number(acudiente_id), Number(estudiante_id)],
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Ya están vinculados" });
    throw e;
  }
}));

export default r;
