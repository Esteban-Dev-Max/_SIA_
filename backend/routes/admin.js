import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { hayChoqueHorarios } from "../lib/horario.js";

const r = Router();
r.use(verifyToken, requireRole("admin"));

const ROLES = ["admin", "profesor", "estudiante", "acudiente"];

// ---------- Avatares de usuarios ----------
const MIME_AVATAR = ["image/jpeg", "image/png", "image/webp"];
const CARPETA_AVATARES = path.join(process.cwd(), "uploads", "avatars");
mkdirSync(CARPETA_AVATARES, { recursive: true });

const storageAvatar = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, CARPETA_AVATARES);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: storageAvatar,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (MIME_AVATAR.includes(file.mimetype)) return cb(null, true);
    const err = new Error("La foto debe ser JPG, PNG o WEBP");
    err.status = 400;
    cb(err);
  },
});

// Envuelve multer para traducir sus errores a respuestas 4xx en español.
function subirAvatar(req, res, next) {
  uploadAvatar.single("foto")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ error: "La foto supera el tamaño máximo permitido (3 MB)" });
      }
      return res.status(err.status ?? 400).json({
        error: err.message || "Error al subir la foto",
      });
    }
    next();
  });
}

function rutaDiscoAvatar(nombre) {
  if (!nombre || typeof nombre !== "string") return null;
  return path.join(CARPETA_AVATARES, path.basename(nombre));
}

async function eliminarAvatar(fotoUrl) {
  // foto_url se guarda como "/api/uploads/avatars/<archivo>"; extrae el nombre.
  const nombre = typeof fotoUrl === "string" ? fotoUrl.split("/").pop() : null;
  const ruta = rutaDiscoAvatar(nombre);
  if (!ruta || !nombre) return;
  try {
    await unlink(ruta);
  } catch (err) {
    if (err.code !== "ENOENT") console.error("No se pudo eliminar el avatar:", err.message);
  }
}

/** foto_url a almacenar para esta petición (null si no subieron archivo). */
function urlAvatarDeReq(req) {
  return req.file ? `/api/uploads/avatars/${req.file.filename}` : null;
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- Dashboard: métricas globales ----------
// Una sola consulta (7 subconsultas → 1 round-trip).
r.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { institucion_id } = req.user;
    const [[row]] = await pool.query(
      `SELECT
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'estudiante' AND institucion_id = ?) AS estudiantes,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'profesor' AND estado = 'activo' AND institucion_id = ?) AS profesores,
       (SELECT COUNT(*) FROM materias WHERE institucion_id = ?) AS materias,
       (SELECT COUNT(*) FROM grupos WHERE institucion_id = ?) AS grupos,
       (SELECT COUNT(*) FROM matriculas WHERE institucion_id = ?) AS matriculas,
       (SELECT COUNT(*) FROM carreras_grados WHERE institucion_id = ?) AS carreras,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'acudiente' AND estado = 'activo' AND institucion_id = ?) AS acudientes`,
      [institucion_id, institucion_id, institucion_id, institucion_id, institucion_id, institucion_id, institucion_id],
    );
    res.json(row);
  }),
);

// ---------- Usuarios ----------
r.get(
  "/usuarios",
  asyncHandler(async (req, res) => {
    const { rol, q } = req.query;
    const { institucion_id } = req.user;
    const conds = ["institucion_id = ?"];
    const params = [institucion_id];
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

    // Paginación opcional (`?page=1&page_size=50`): si se pide, se devuelve el
    // objeto paginado; sin `page` se conserva el arreglo completo (compatible).
    const page = Number(req.query.page);
    if (Number.isInteger(page) && page > 0) {
      const pageSize = Math.min(Number(req.query.page_size) || 50, 500);
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios ${where}`,
        params,
      );
      const [rows] = await pool.query(
        `SELECT id, nombre_completo, correo, rol, estado, foto_url, fecha_creacion
       FROM usuarios ${where}
       ORDER BY fecha_creacion DESC, id DESC
       LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize],
      );
      return res.json({
        items: rows,
        total,
        page,
        page_size: pageSize,
        total_pages: total === 0 ? 1 : Math.ceil(total / pageSize),
      });
    }

    const [rows] = await pool.query(
      `SELECT id, nombre_completo, correo, rol, estado, foto_url, fecha_creacion
     FROM usuarios ${where}
     ORDER BY fecha_creacion DESC, id DESC`,
      params,
    );
    res.json(rows);
  }),
);

r.post(
  "/usuarios",
  subirAvatar,
  asyncHandler(async (req, res) => {
    const { nombre_completo, correo, password, rol, foto_url } = req.body;
    if (
      typeof nombre_completo !== "string" ||
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !nombre_completo.trim() ||
      !correo.trim() ||
      !password ||
      !rol
    ) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    if (!ROLES.includes(rol))
      return res.status(400).json({ error: "Rol inválido" });
    const hash = await bcrypt.hash(password, 10);
    try {
      const [result] = await pool.query(
        `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, foto_url, institucion_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          nombre_completo.trim(),
          correo.trim().toLowerCase(),
          hash,
          rol,
          urlAvatarDeReq(req) ?? foto_url ?? null,
          req.user.institucion_id,
        ],
      );
      if (rol === "estudiante") {
        await pool.query(
          "UPDATE usuarios SET codigo_carnet = ? WHERE id = ?",
          [`EST-${String(result.insertId).padStart(5, "0")}`, result.insertId],
        );
      }
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "El correo ya está registrado" });
      }
      throw e;
    }
  }),
);

r.put(
  "/usuarios/:id",
  subirAvatar,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { nombre_completo, correo, rol, estado, password } = req.body;
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
      if (!ROLES.includes(rol))
        return res.status(400).json({ error: "Rol inválido" });
      sets.push("rol = ?");
      params.push(rol);
    }
    if (estado !== undefined) {
      sets.push("estado = ?");
      params.push(estado);
    }
    // Foto de perfil: reemplazo por archivo nuevo o quitado explícito
    // (quitar_foto="true" llega como texto cuando el cuerpo es multipart).
    const avatarNuevo = urlAvatarDeReq(req);
    const quitaFoto = !req.file && req.body.quitar_foto === "true";
    let avatarAnterior = null;
    if (avatarNuevo || quitaFoto) {
      const [[prev]] = await pool.query(
        "SELECT foto_url FROM usuarios WHERE id = ?",
        [id],
      );
      avatarAnterior = prev?.foto_url ?? null;
    }
    if (avatarNuevo) {
      sets.push("foto_url = ?");
      params.push(avatarNuevo);
    } else if (quitaFoto) {
      sets.push("foto_url = NULL");
    }
    if (password) {
      if (typeof password !== "string") {
        return res.status(400).json({ error: "Contraseña inválida" });
      }
      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: "La contraseña debe tener al menos 6 caracteres" });
      }
      sets.push("`password` = ?");
      params.push(await bcrypt.hash(password, 10));
    }
    if (sets.length === 0)
      return res.status(400).json({ error: "Nada que actualizar" });
    params.push(id, req.user.institucion_id);
    try {
      await pool.query(
        `UPDATE usuarios SET ${sets.join(", ")} WHERE id = ? AND institucion_id = ?`,
        params,
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        // No se aplicó el cambio: descarta el archivo recién subido para no dejar huérfanos.
        if (avatarNuevo) await eliminarAvatar(avatarNuevo);
        return res.status(400).json({ error: "El correo ya está registrado" });
      }
      throw e;
    }
    if ((avatarNuevo || quitaFoto) && avatarAnterior) {
      await eliminarAvatar(avatarAnterior);
    }
    res.json({ ok: true });
  }),
);

// ---------- Carreras / grados ----------
r.get(
  "/carreras",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM carreras_grados WHERE institucion_id = ? ORDER BY nombre",
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/carreras",
  asyncHandler(async (req, res) => {
    const { nombre, codigo } = req.body;
    if (!nombre) return res.status(400).json({ error: "Faltan datos" });
    const code =
      codigo?.trim() ||
      nombre
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    try {
      const [result] = await pool.query(
        "INSERT INTO carreras_grados (nombre, codigo, institucion_id) VALUES (?, ?, ?)",
        [nombre.trim(), code, req.user.institucion_id],
      );
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "El código ya existe" });
      throw e;
    }
  }),
);

r.put(
  "/carreras/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { nombre, codigo } = req.body;
    if (!nombre || !codigo)
      return res.status(400).json({ error: "Faltan datos" });
    try {
      await pool.query(
        "UPDATE carreras_grados SET nombre = ?, codigo = ? WHERE id = ? AND institucion_id = ?",
        [nombre.trim(), codigo.trim(), id, req.user.institucion_id],
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "El código ya existe" });
      throw e;
    }
    // Se devuelve la entidad actualizada (y 404 si no existe, en lugar de
    // confiar en affectedRows que da 0 cuando los valores no cambian).
    const [[row]] = await pool.query(
      "SELECT id, nombre, codigo FROM carreras_grados WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (!row) return res.status(404).json({ error: "Carrera no encontrada" });
    res.json(row);
  }),
);

r.delete(
  "/carreras/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM carreras_grados WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Carrera no encontrada" });
    res.json({ ok: true });
  }),
);

// ---------- Materias ----------
r.get(
  "/materias",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT m.id, m.nombre, m.codigo, m.carrera_id, c.nombre AS carrera_nombre
     FROM materias m
      LEFT JOIN carreras_grados c ON c.id = m.carrera_id
      WHERE m.institucion_id = ?
      ORDER BY m.nombre`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/materias",
  asyncHandler(async (req, res) => {
    const { nombre, codigo, carrera_id } = req.body;
    if (!nombre || !codigo)
      return res.status(400).json({ error: "Faltan datos" });
    try {
      const [result] = await pool.query(
        `INSERT INTO materias (nombre, codigo, carrera_id, institucion_id) VALUES (?, ?, ?, ?)`,
        [
          nombre.trim(),
          codigo.trim().toUpperCase(),
          carrera_id ? Number(carrera_id) : null,
          req.user.institucion_id,
        ],
      );
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "El código ya existe" });
      throw e;
    }
  }),
);

r.put(
  "/materias/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { nombre, codigo, carrera_id } = req.body;
    if (!nombre || !codigo)
      return res.status(400).json({ error: "Faltan datos" });
    try {
      await pool.query(
        `UPDATE materias SET nombre = ?, codigo = ?, carrera_id = ? WHERE id = ? AND institucion_id = ?`,
        [
          nombre.trim(),
          codigo.trim().toUpperCase(),
          carrera_id ? Number(carrera_id) : null,
          id,
          req.user.institucion_id,
        ],
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "El código ya existe" });
      throw e;
    }
    // Entidad actualizada (con el nombre de carrera resuelto).
    const [[row]] = await pool.query(
      `SELECT m.id, m.nombre, m.codigo, m.carrera_id, c.nombre AS carrera_nombre
       FROM materias m
       LEFT JOIN carreras_grados c ON c.id = m.carrera_id
       WHERE m.id = ? AND m.institucion_id = ?`,
      [id, req.user.institucion_id],
    );
    if (!row) return res.status(404).json({ error: "Materia no encontrada" });
    res.json(row);
  }),
);

r.delete(
  "/materias/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM materias WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Materia no encontrada" });
    res.json({ ok: true });
  }),
);

// ---------- Grupos (materia + código/ficha + profesor + periodo) ----------
r.get(
  "/grupos",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT g.id, g.materia_id, g.codigo_grupo, g.periodo, g.horario,
            m.nombre AS materia, m.codigo AS materia_codigo,
            u.id AS profesor_id, u.nombre_completo AS profesor,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.grupo_id = g.id) AS alumnos
     FROM grupos g
     JOIN materias m ON m.id = g.materia_id
     LEFT JOIN usuarios u ON u.id = g.profesor_id
     WHERE g.institucion_id = ?
     ORDER BY m.nombre, g.codigo_grupo`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/grupos",
  asyncHandler(async (req, res) => {
    const { materia_id, codigo_grupo, profesor_id, periodo, horario } =
      req.body;
    const { institucion_id } = req.user;
    const materiaId = parseId(materia_id);
    const profesorId = parseId(profesor_id);
    const codigo = typeof codigo_grupo === "string" ? codigo_grupo.trim() : "";
    if (!materiaId || !profesorId || !codigo || !periodo) {
      return res
        .status(400)
        .json({ error: "Faltan datos (código/ficha del grupo obligatorio)" });
    }
    const [[mat]] = await pool.query(
      "SELECT id FROM materias WHERE id = ? AND institucion_id = ?",
      [materiaId, institucion_id],
    );
    if (!mat) return res.status(400).json({ error: "La materia no existe" });
    const [[prof]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor' AND institucion_id = ?",
      [profesorId, institucion_id],
    );
    if (!prof) return res.status(400).json({ error: "El profesor no existe" });
    // Unicidad: no puede haber otro grupo con el mismo código/ficha de la materia
    // en el mismo periodo (evita secciones duplicadas).
    const [[dupG]] = await pool.query(
      `SELECT id FROM grupos
     WHERE materia_id = ? AND LOWER(codigo_grupo) = LOWER(?) AND periodo = ? AND institucion_id = ?`,
      [materiaId, codigo, String(periodo), institucion_id],
    );
    if (dupG) {
      return res.status(400).json({
        error:
          "Ya existe un grupo con ese código/ficha y periodo para la materia",
      });
    }
    const [result] = await pool.query(
      "INSERT INTO grupos (materia_id, codigo_grupo, profesor_id, periodo, horario, institucion_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        materiaId,
        codigo,
        profesorId,
        String(periodo),
        horario ?? null,
        institucion_id,
      ],
    );
    res.json({ ok: true, id: result.insertId });
  }),
);

// Edita un grupo (ficha/código, profesor, periodo y horario). La materia no se
// toca: cambiarla reasignaría el histórico de notas/asistencia de los matriculados.
r.put(
  "/grupos/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { codigo_grupo, profesor_id, periodo, horario } = req.body;
    const profesorId = parseId(profesor_id);
    const codigo = typeof codigo_grupo === "string" ? codigo_grupo.trim() : "";
    if (!profesorId || !codigo || !periodo) {
      return res
        .status(400)
        .json({ error: "Faltan datos (código/ficha del grupo obligatorio)" });
    }
    const [[grupo]] = await pool.query(
      "SELECT id, materia_id FROM grupos WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });
    const [[prof]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor' AND institucion_id = ?",
      [profesorId, req.user.institucion_id],
    );
    if (!prof) return res.status(400).json({ error: "El profesor no existe" });
    // Misma unicidad del POST (materia + código/ficha + periodo), excluyendo el propio grupo.
    const [[dupG]] = await pool.query(
      `SELECT id FROM grupos
       WHERE materia_id = ? AND LOWER(codigo_grupo) = LOWER(?) AND periodo = ? AND id <> ? AND institucion_id = ?`,
      [grupo.materia_id, codigo, String(periodo), id, req.user.institucion_id],
    );
    if (dupG) {
      return res.status(400).json({
        error:
          "Ya existe un grupo con ese código/ficha y periodo para la materia",
      });
    }
    await pool.query(
      "UPDATE grupos SET codigo_grupo = ?, profesor_id = ?, periodo = ?, horario = ? WHERE id = ? AND institucion_id = ?",
      [codigo, profesorId, String(periodo), horario ?? null, id, req.user.institucion_id],
    );
    // Entidad actualizada con el mismo formato del GET.
    const [[row]] = await pool.query(
      `SELECT g.id, g.materia_id, g.codigo_grupo, g.periodo, g.horario,
              m.nombre AS materia, m.codigo AS materia_codigo,
              u.id AS profesor_id, u.nombre_completo AS profesor,
              (SELECT COUNT(*) FROM matriculas mat WHERE mat.grupo_id = g.id) AS alumnos
       FROM grupos g
       JOIN materias m ON m.id = g.materia_id
       LEFT JOIN usuarios u ON u.id = g.profesor_id
       WHERE g.id = ? AND g.institucion_id = ?`,
      [id, req.user.institucion_id],
    );
    res.json(row);
  }),
);

r.delete(
  "/grupos/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM grupos WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Grupo no encontrado" });
    res.json({ ok: true });
  }),
);

// ---------- Matrículas ----------
r.get(
  "/matriculas",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT mat.id, mat.estudiante_id, u.nombre_completo AS estudiante, u.correo,
            g.id AS grupo_id, g.codigo_grupo, m.nombre AS materia, g.periodo, mat.fecha_matricula
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     WHERE mat.institucion_id = ?
     ORDER BY mat.id DESC`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/matriculas",
  asyncHandler(async (req, res) => {
    const { estudiante_id, grupo_id, fecha_matricula } = req.body;
    const { institucion_id } = req.user;
    const estudianteId = parseId(estudiante_id);
    const grupoId = parseId(grupo_id);
    if (!estudianteId || !grupoId)
      return res.status(400).json({ error: "Faltan datos" });
    if (fecha_matricula != null && fecha_matricula !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_matricula))) {
        return res.status(400).json({ error: "Fecha inválida" });
      }
    }
    const [[est]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'estudiante' AND estado = 'activo' AND institucion_id = ?",
      [estudianteId, institucion_id],
    );
    if (!est) {
      return res
        .status(400)
        .json({ error: "El estudiante no existe o no está activo" });
    }
    const [[grp]] = await pool.query(
      "SELECT id, materia_id, horario FROM grupos WHERE id = ? AND institucion_id = ?",
      [grupoId, institucion_id],
    );
    if (!grp) return res.status(400).json({ error: "El grupo no existe" });
    // Unicidad de materia: no se permite matricular al estudiante en dos secciones
    // de la misma materia.
    const [previos] = await pool.query(
      `SELECT g.id, g.codigo_grupo AS grupo, g.horario, g.materia_id, m.nombre AS materia
     FROM matriculas mat
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     WHERE mat.estudiante_id = ? AND g.id <> ? AND mat.institucion_id = ?`,
      [estudianteId, grupoId, institucion_id],
    );
    const duplicada = previos.find((p) => p.materia_id === grp.materia_id);
    if (duplicada) {
      return res.status(400).json({
        error: `El estudiante ya está matriculado en otra sección de ${duplicada.materia} (ficha ${duplicada.grupo})`,
      });
    }
    // Restricción de horario: no puede haber choque con el de otra materia.
    for (const p of previos) {
      if (hayChoqueHorarios(grp.horario, p.horario)) {
        return res.status(400).json({
          error: `El horario del grupo choca con ${p.materia} (ficha ${p.grupo})`,
        });
      }
    }
    try {
      const [result] = await pool.query(
        `INSERT INTO matriculas (estudiante_id, grupo_id, fecha_matricula, institucion_id) VALUES (?, ?, ?, ?)`,
        [
          estudianteId,
          grupoId,
          fecha_matricula ?? new Date().toISOString().slice(0, 10),
          institucion_id,
        ],
      );
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ error: "El estudiante ya está matriculado en ese grupo" });
      }
      throw e;
    }
  }),
);

// Edita una matrícula (grupo/sección y fecha opcional). El estudiante no se
// toca: cambiarlo transferiría notas/asistencia registradas en la matrícula.
r.put(
  "/matriculas/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { grupo_id, fecha_matricula } = req.body;
    const grupoId = parseId(grupo_id);
    if (!grupoId) return res.status(400).json({ error: "Faltan datos" });
    if (fecha_matricula != null && fecha_matricula !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_matricula))) {
        return res.status(400).json({ error: "Fecha inválida" });
      }
    }
    const [[mat]] = await pool.query(
      "SELECT id, estudiante_id FROM matriculas WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (!mat) return res.status(404).json({ error: "Matrícula no encontrada" });
    const [[grp]] = await pool.query(
      "SELECT id, materia_id, horario FROM grupos WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (!grp) return res.status(400).json({ error: "El grupo no existe" });
    // Mismas reglas del POST (materia duplicada y choque de horarios),
    // excluyendo la propia matrícula y el grupo destino de la comparación.
    const [previos] = await pool.query(
      `SELECT g.id, g.codigo_grupo AS grupo, g.horario, g.materia_id, m.nombre AS materia
       FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       JOIN materias m ON m.id = g.materia_id
       WHERE mat.estudiante_id = ? AND mat.id <> ? AND g.id <> ? AND mat.institucion_id = ?`,
      [mat.estudiante_id, id, grupoId, req.user.institucion_id],
    );
    const duplicada = previos.find((p) => p.materia_id === grp.materia_id);
    if (duplicada) {
      return res.status(400).json({
        error: `El estudiante ya está matriculado en otra sección de ${duplicada.materia} (ficha ${duplicada.grupo})`,
      });
    }
    for (const p of previos) {
      if (hayChoqueHorarios(grp.horario, p.horario)) {
        return res.status(400).json({
          error: `El horario del grupo choca con ${p.materia} (ficha ${p.grupo})`,
        });
      }
    }
    try {
      await pool.query(
        "UPDATE matriculas SET grupo_id = ?, fecha_matricula = COALESCE(?, fecha_matricula) WHERE id = ? AND institucion_id = ?",
        [grupoId, fecha_matricula || null, id, req.user.institucion_id],
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ error: "El estudiante ya está matriculado en ese grupo" });
      }
      throw e;
    }
    // Entidad actualizada con el mismo formato del GET.
    const [[row]] = await pool.query(
      `SELECT mat.id, mat.estudiante_id, u.nombre_completo AS estudiante, u.correo,
              g.id AS grupo_id, g.codigo_grupo, m.nombre AS materia, g.periodo, mat.fecha_matricula
       FROM matriculas mat
       JOIN usuarios u ON u.id = mat.estudiante_id
       JOIN grupos g ON g.id = mat.grupo_id
       JOIN materias m ON m.id = g.materia_id
       WHERE mat.id = ? AND mat.institucion_id = ?`,
      [id, req.user.institucion_id],
    );
    res.json(row);
  }),
);

r.delete(
  "/matriculas/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM matriculas WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Matrícula no encontrada" });
    }
    res.json({ ok: true });
  }),
);

// ---------- Vincular acudiente con estudiante ----------
// Lista todas las vinculaciones (con nombres), opcionalmente filtradas por
// acudiente o estudiante.
r.get(
  "/vincular-acudiente",
  asyncHandler(async (req, res) => {
    const { institucion_id } = req.user;
    const conds = ["ua.institucion_id = ?", "ue.institucion_id = ?"];
    const params = [institucion_id, institucion_id];
    const acudienteId = parseId(req.query.acudiente_id);
    const estudianteId = parseId(req.query.estudiante_id);
    if (acudienteId) {
      conds.push("ae.acudiente_id = ?");
      params.push(acudienteId);
    }
    if (estudianteId) {
      conds.push("ae.estudiante_id = ?");
      params.push(estudianteId);
    }
    const where = "WHERE " + conds.join(" AND ");
    const [rows] = await pool.query(
      `SELECT ae.id, ae.acudiente_id, ua.nombre_completo AS acudiente, ua.correo AS acudiente_correo,
            ae.estudiante_id, ue.nombre_completo AS estudiante, ue.correo AS estudiante_correo
     FROM acudiente_estudiante ae
     JOIN usuarios ua ON ua.id = ae.acudiente_id
     JOIN usuarios ue ON ue.id = ae.estudiante_id
     ${where}
     ORDER BY ua.nombre_completo, ue.nombre_completo`,
      params,
    );
    res.json(rows);
  }),
);

r.delete(
  "/vincular-acudiente/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { institucion_id } = req.user;
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      `DELETE ae FROM acudiente_estudiante ae
       JOIN usuarios ua ON ua.id = ae.acudiente_id
       WHERE ae.id = ? AND ua.institucion_id = ?`,
      [id, institucion_id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Vinculación no encontrada" });
    }
    res.json({ ok: true });
  }),
);

r.post(
  "/vincular-acudiente",
  asyncHandler(async (req, res) => {
    const { acudiente_id, estudiante_id } = req.body;
    const { institucion_id } = req.user;
    const acudienteId = parseId(acudiente_id);
    const estudianteIdV = parseId(estudiante_id);
    if (!acudienteId || !estudianteIdV)
      return res.status(400).json({ error: "Faltan datos" });
    const [[acu]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'acudiente' AND institucion_id = ?",
      [acudienteId, institucion_id],
    );
    if (!acu) return res.status(400).json({ error: "El acudiente no existe" });
    const [[est]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'estudiante' AND institucion_id = ?",
      [estudianteIdV, institucion_id],
    );
    if (!est) return res.status(400).json({ error: "El estudiante no existe" });
    try {
      const [result] = await pool.query(
        "INSERT INTO acudiente_estudiante (acudiente_id, estudiante_id) VALUES (?, ?)",
        [acudienteId, estudianteIdV],
      );
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "Ya están vinculados" });
      throw e;
    }
  }),
);

// Edita una vinculación acudiente-estudiante (cambia cualquiera de los dos).
r.put(
  "/vincular-acudiente/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { institucion_id } = req.user;
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { acudiente_id, estudiante_id } = req.body;
    const acudienteId = parseId(acudiente_id);
    const estudianteIdV = parseId(estudiante_id);
    if (!acudienteId || !estudianteIdV)
      return res.status(400).json({ error: "Faltan datos" });
    const [[vin]] = await pool.query(
      `SELECT ae.id FROM acudiente_estudiante ae
       JOIN usuarios ua ON ua.id = ae.acudiente_id
       WHERE ae.id = ? AND ua.institucion_id = ?`,
      [id, institucion_id],
    );
    if (!vin)
      return res.status(404).json({ error: "Vinculación no encontrada" });
    const [[acu]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'acudiente' AND institucion_id = ?",
      [acudienteId, institucion_id],
    );
    if (!acu) return res.status(400).json({ error: "El acudiente no existe" });
    const [[est]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'estudiante' AND institucion_id = ?",
      [estudianteIdV, institucion_id],
    );
    if (!est) return res.status(400).json({ error: "El estudiante no existe" });
    try {
      await pool.query(
        "UPDATE acudiente_estudiante SET acudiente_id = ?, estudiante_id = ? WHERE id = ?",
        [acudienteId, estudianteIdV, id],
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "Ya están vinculados" });
      throw e;
    }
    // Entidad actualizada con el mismo formato del GET.
    const [[row]] = await pool.query(
      `SELECT ae.id, ae.acudiente_id, ua.nombre_completo AS acudiente, ua.correo AS acudiente_correo,
              ae.estudiante_id, ue.nombre_completo AS estudiante, ue.correo AS estudiante_correo
       FROM acudiente_estudiante ae
       JOIN usuarios ua ON ua.id = ae.acudiente_id
       JOIN usuarios ue ON ue.id = ae.estudiante_id
       WHERE ae.id = ? AND ua.institucion_id = ?`,
      [id, institucion_id],
    );
    res.json(row);
  }),
);

export default r;
