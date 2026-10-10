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

// Periodos del año lectivo: AAAA-PN (ej. 2026-P1, con N de 1 a 4).
const PERIODO_RE = /^\d{4}-P[1-4]$/;
function periodoValido(value) {
  return typeof value === "string" && PERIODO_RE.test(value.trim());
}

function anoLectivoValido(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

// ---------- Dashboard: métricas globales ----------
// Una sola consulta (8 subconsultas → 1 round-trip).
r.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { institucion_id } = req.user;
    const [[row]] = await pool.query(
      `SELECT
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'estudiante' AND institucion_id = ?) AS estudiantes,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'profesor' AND estado = 'activo' AND institucion_id = ?) AS docentes,
       (SELECT COUNT(*) FROM grados WHERE institucion_id = ?) AS grados,
       (SELECT COUNT(*) FROM asignaturas WHERE institucion_id = ?) AS asignaturas,
       (SELECT COUNT(*) FROM cursos WHERE institucion_id = ?) AS cursos,
       (SELECT COUNT(*) FROM asignaciones WHERE institucion_id = ?) AS asignaciones,
       (SELECT COUNT(*) FROM matriculas_curso WHERE institucion_id = ?) AS matriculas,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'acudiente' AND estado = 'activo' AND institucion_id = ?) AS acudientes`,
      [institucion_id, institucion_id, institucion_id, institucion_id, institucion_id, institucion_id, institucion_id, institucion_id],
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

// ---------- Grados ----------
const NIVELES = ["preescolar", "primaria", "secundaria", "media"];

r.get(
  "/grados",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM grados WHERE institucion_id = ? ORDER BY orden, nombre",
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/grados",
  asyncHandler(async (req, res) => {
    const { nombre, nivel, orden } = req.body;
    if (!nombre || !NIVELES.includes(nivel))
      return res.status(400).json({ error: "Faltan datos (nombre y nivel)" });
    try {
      const [result] = await pool.query(
        "INSERT INTO grados (nombre, nivel, orden, institucion_id) VALUES (?, ?, ?, ?)",
        [nombre.trim(), nivel, Number(orden) || 0, req.user.institucion_id],
      );
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "El grado ya existe" });
      throw e;
    }
  }),
);

r.put(
  "/grados/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { nombre, nivel, orden } = req.body;
    if (!nombre || !NIVELES.includes(nivel))
      return res.status(400).json({ error: "Faltan datos (nombre y nivel)" });
    await pool.query(
      "UPDATE grados SET nombre = ?, nivel = ?, orden = ? WHERE id = ? AND institucion_id = ?",
      [nombre.trim(), nivel, Number(orden) || 0, id, req.user.institucion_id],
    );
    // Se devuelve la entidad actualizada (y 404 si no existe, en lugar de
    // confiar en affectedRows que da 0 cuando los valores no cambian).
    const [[row]] = await pool.query(
      "SELECT id, nombre, nivel, orden FROM grados WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (!row) return res.status(404).json({ error: "Grado no encontrado" });
    res.json(row);
  }),
);

r.delete(
  "/grados/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM grados WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Grado no encontrado" });
    res.json({ ok: true });
  }),
);

// ---------- Asignaturas ----------
r.get(
  "/asignaturas",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT a.id, a.nombre, a.codigo, a.grado_id, g.nombre AS grado_nombre, g.nivel AS grado_nivel
     FROM asignaturas a
      LEFT JOIN grados g ON g.id = a.grado_id
      WHERE a.institucion_id = ?
      ORDER BY a.nombre`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/asignaturas",
  asyncHandler(async (req, res) => {
    const { nombre, codigo, grado_id } = req.body;
    if (!nombre) return res.status(400).json({ error: "Faltan datos" });
    const gradoId = grado_id ? Number(grado_id) : null;
    if (gradoId) {
      const [[g]] = await pool.query(
        "SELECT id FROM grados WHERE id = ? AND institucion_id = ?",
        [gradoId, req.user.institucion_id],
      );
      if (!g) return res.status(400).json({ error: "El grado no existe" });
    }
    try {
      const [result] = await pool.query(
        `INSERT INTO asignaturas (nombre, codigo, grado_id, institucion_id) VALUES (?, ?, ?, ?)`,
        [
          nombre.trim(),
          codigo?.trim() ? codigo.trim().toUpperCase() : null,
          gradoId,
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
  "/asignaturas/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { nombre, codigo, grado_id } = req.body;
    if (!nombre) return res.status(400).json({ error: "Faltan datos" });
    const gradoId = grado_id ? Number(grado_id) : null;
    if (gradoId) {
      const [[g]] = await pool.query(
        "SELECT id FROM grados WHERE id = ? AND institucion_id = ?",
        [gradoId, req.user.institucion_id],
      );
      if (!g) return res.status(400).json({ error: "El grado no existe" });
    }
    try {
      await pool.query(
        `UPDATE asignaturas SET nombre = ?, codigo = ?, grado_id = ? WHERE id = ? AND institucion_id = ?`,
        [
          nombre.trim(),
          codigo?.trim() ? codigo.trim().toUpperCase() : null,
          gradoId,
          id,
          req.user.institucion_id,
        ],
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        return res.status(400).json({ error: "El código ya existe" });
      throw e;
    }
    // Entidad actualizada (con el nombre de grado resuelto).
    const [[row]] = await pool.query(
      `SELECT a.id, a.nombre, a.codigo, a.grado_id, g.nombre AS grado_nombre, g.nivel AS grado_nivel
       FROM asignaturas a
       LEFT JOIN grados g ON g.id = a.grado_id
       WHERE a.id = ? AND a.institucion_id = ?`,
      [id, req.user.institucion_id],
    );
    if (!row) return res.status(404).json({ error: "Asignatura no encontrada" });
    res.json(row);
  }),
);

r.delete(
  "/asignaturas/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM asignaturas WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Asignatura no encontrada" });
    res.json({ ok: true });
  }),
);

// ---------- Cursos (sección de un grado en un año lectivo) ----------
r.get(
  "/cursos",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT c.id, c.grado_id, c.nombre, c.ano_lectivo,
            g.nombre AS grado_nombre, g.nivel AS grado_nivel,
            u.id AS director_id, u.nombre_completo AS director,
            (SELECT COUNT(*) FROM matriculas_curso mc WHERE mc.curso_id = c.id) AS alumnos
     FROM cursos c
     JOIN grados g ON g.id = c.grado_id
     LEFT JOIN usuarios u ON u.id = c.director_id
     WHERE c.institucion_id = ?
     ORDER BY c.ano_lectivo DESC, g.orden, g.nombre, c.nombre`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/cursos",
  asyncHandler(async (req, res) => {
    const { grado_id, nombre, director_id, ano_lectivo } = req.body;
    const { institucion_id } = req.user;
    const gradoId = parseId(grado_id);
    const ano = anoLectivoValido(ano_lectivo);
    const letra = typeof nombre === "string" ? nombre.trim().toUpperCase() : "";
    if (!gradoId || !letra || !ano) {
      return res.status(400).json({ error: "Faltan datos (grado, curso y año)" });
    }
    const [[g]] = await pool.query(
      "SELECT id FROM grados WHERE id = ? AND institucion_id = ?",
      [gradoId, institucion_id],
    );
    if (!g) return res.status(400).json({ error: "El grado no existe" });
    const directorId = parseId(director_id);
    if (directorId) {
      const [[d]] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor' AND institucion_id = ?",
        [directorId, institucion_id],
      );
      if (!d)
        return res.status(400).json({ error: "El director de grupo no existe" });
    }
    const [[dup]] = await pool.query(
      `SELECT id FROM cursos
       WHERE grado_id = ? AND nombre = ? AND ano_lectivo = ? AND institucion_id = ?`,
      [gradoId, letra, ano, institucion_id],
    );
    if (dup) {
      return res.status(400).json({
        error: "Ya existe ese curso para el grado en ese año lectivo",
      });
    }
    const [result] = await pool.query(
      "INSERT INTO cursos (grado_id, nombre, director_id, ano_lectivo, institucion_id) VALUES (?, ?, ?, ?, ?)",
      [gradoId, letra, directorId, ano, institucion_id],
    );
    res.json({ ok: true, id: result.insertId });
  }),
);

r.put(
  "/cursos/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { nombre, director_id, ano_lectivo } = req.body;
    const ano = anoLectivoValido(ano_lectivo);
    const letra = typeof nombre === "string" ? nombre.trim().toUpperCase() : "";
    if (!letra || !ano) {
      return res.status(400).json({ error: "Faltan datos (curso y año)" });
    }
    const [[curso]] = await pool.query(
      "SELECT id, grado_id FROM cursos WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (!curso) return res.status(404).json({ error: "Curso no encontrado" });
    const directorId = parseId(director_id);
    if (directorId) {
      const [[d]] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor' AND institucion_id = ?",
        [directorId, req.user.institucion_id],
      );
      if (!d)
        return res.status(400).json({ error: "El director de grupo no existe" });
    }
    const [[dup]] = await pool.query(
      `SELECT id FROM cursos
       WHERE grado_id = ? AND nombre = ? AND ano_lectivo = ? AND id <> ? AND institucion_id = ?`,
      [curso.grado_id, letra, ano, id, req.user.institucion_id],
    );
    if (dup) {
      return res.status(400).json({
        error: "Ya existe ese curso para el grado en ese año lectivo",
      });
    }
    await pool.query(
      "UPDATE cursos SET nombre = ?, director_id = ?, ano_lectivo = ? WHERE id = ? AND institucion_id = ?",
      [letra, directorId, ano, id, req.user.institucion_id],
    );
    // Entidad actualizada con el mismo formato del GET.
    const [[row]] = await pool.query(
      `SELECT c.id, c.grado_id, c.nombre, c.ano_lectivo,
              g.nombre AS grado_nombre, g.nivel AS grado_nivel,
              u.id AS director_id, u.nombre_completo AS director,
              (SELECT COUNT(*) FROM matriculas_curso mc WHERE mc.curso_id = c.id) AS alumnos
       FROM cursos c
       JOIN grados g ON g.id = c.grado_id
       LEFT JOIN usuarios u ON u.id = c.director_id
       WHERE c.id = ? AND c.institucion_id = ?`,
      [id, req.user.institucion_id],
    );
    res.json(row);
  }),
);

r.delete(
  "/cursos/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM cursos WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Curso no encontrado" });
    res.json({ ok: true });
  }),
);

// ---------- Asignaciones (asignatura de un curso con docente y periodo) ----------
r.get(
  "/asignaciones",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT a.id, a.curso_id, a.asignatura_id, a.periodo, a.horario,
            CONCAT(g.nombre, ' ', c.nombre) AS curso, c.ano_lectivo,
            s.nombre AS asignatura, s.codigo AS asignatura_codigo,
            u.id AS docente_id, u.nombre_completo AS docente,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.asignacion_id = a.id) AS alumnos
     FROM asignaciones a
     JOIN cursos c ON c.id = a.curso_id
     JOIN grados g ON g.id = c.grado_id
     JOIN asignaturas s ON s.id = a.asignatura_id
     LEFT JOIN usuarios u ON u.id = a.docente_id
     WHERE a.institucion_id = ?
     ORDER BY c.ano_lectivo DESC, g.orden, c.nombre, s.nombre, a.periodo`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/asignaciones",
  asyncHandler(async (req, res) => {
    const { curso_id, asignatura_id, docente_id, periodo, horario } = req.body;
    const { institucion_id } = req.user;
    const cursoId = parseId(curso_id);
    const asignaturaId = parseId(asignatura_id);
    const docenteId = parseId(docente_id);
    if (!cursoId || !asignaturaId || !docenteId || !periodoValido(periodo)) {
      return res.status(400).json({
        error: "Faltan datos (curso, asignatura, docente y periodo AAAA-PN)",
      });
    }
    const [[cur]] = await pool.query(
      "SELECT id FROM cursos WHERE id = ? AND institucion_id = ?",
      [cursoId, institucion_id],
    );
    if (!cur) return res.status(400).json({ error: "El curso no existe" });
    const [[asi]] = await pool.query(
      "SELECT id FROM asignaturas WHERE id = ? AND institucion_id = ?",
      [asignaturaId, institucion_id],
    );
    if (!asi) return res.status(400).json({ error: "La asignatura no existe" });
    const [[doc]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor' AND institucion_id = ?",
      [docenteId, institucion_id],
    );
    if (!doc) return res.status(400).json({ error: "El docente no existe" });
    // Unicidad: una asignatura no se asigna dos veces al mismo curso y periodo.
    const [[dup]] = await pool.query(
      `SELECT id FROM asignaciones
       WHERE curso_id = ? AND asignatura_id = ? AND periodo = ? AND institucion_id = ?`,
      [cursoId, asignaturaId, String(periodo).trim(), institucion_id],
    );
    if (dup) {
      return res.status(400).json({
        error: "Esa asignatura ya está asignada al curso en ese periodo",
      });
    }
    // El docente no puede estar en dos cursos a la misma hora dentro del periodo.
    const [otras] = await pool.query(
      `SELECT a.horario, CONCAT(g.nombre, ' ', c.nombre) AS curso, s.nombre AS asignatura
       FROM asignaciones a
       JOIN cursos c ON c.id = a.curso_id
       JOIN grados g ON g.id = c.grado_id
       JOIN asignaturas s ON s.id = a.asignatura_id
       WHERE a.docente_id = ? AND a.periodo = ? AND a.institucion_id = ?`,
      [docenteId, String(periodo).trim(), institucion_id],
    );
    const choque = otras.find((o) => hayChoqueHorarios(horario, o.horario));
    if (choque) {
      return res.status(400).json({
        error: `El docente ya tiene clase a esa hora (${choque.asignatura} en ${choque.curso})`,
      });
    }
    const [result] = await pool.query(
      "INSERT INTO asignaciones (curso_id, asignatura_id, docente_id, periodo, horario, institucion_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        cursoId,
        asignaturaId,
        docenteId,
        String(periodo).trim(),
        horario ?? null,
        institucion_id,
      ],
    );
    res.json({ ok: true, id: result.insertId });
  }),
);

// Edita una asignación (docente, periodo y horario). El curso y la asignatura
// no se tocan: cambiarlos reasignaría el histórico de notas/asistencia.
r.put(
  "/asignaciones/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { docente_id, periodo, horario } = req.body;
    const docenteId = parseId(docente_id);
    if (!docenteId || !periodoValido(periodo)) {
      return res.status(400).json({
        error: "Faltan datos (docente y periodo AAAA-PN)",
      });
    }
    const [[asi]] = await pool.query(
      "SELECT id, curso_id, asignatura_id FROM asignaciones WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (!asi)
      return res.status(404).json({ error: "Asignación no encontrada" });
    const [[doc]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor' AND institucion_id = ?",
      [docenteId, req.user.institucion_id],
    );
    if (!doc) return res.status(400).json({ error: "El docente no existe" });
    // Misma unicidad del POST, excluyendo la propia asignación.
    const [[dup]] = await pool.query(
      `SELECT id FROM asignaciones
       WHERE curso_id = ? AND asignatura_id = ? AND periodo = ? AND id <> ? AND institucion_id = ?`,
      [asi.curso_id, asi.asignatura_id, String(periodo).trim(), id, req.user.institucion_id],
    );
    if (dup) {
      return res.status(400).json({
        error: "Esa asignatura ya está asignada al curso en ese periodo",
      });
    }
    // Mismo chequeo de horario del docente que en el POST.
    const [otras] = await pool.query(
      `SELECT a.horario, CONCAT(g.nombre, ' ', c.nombre) AS curso, s.nombre AS asignatura
       FROM asignaciones a
       JOIN cursos c ON c.id = a.curso_id
       JOIN grados g ON g.id = c.grado_id
       JOIN asignaturas s ON s.id = a.asignatura_id
       WHERE a.docente_id = ? AND a.periodo = ? AND a.id <> ? AND a.institucion_id = ?`,
      [docenteId, String(periodo).trim(), id, req.user.institucion_id],
    );
    const choque = otras.find((o) => hayChoqueHorarios(horario, o.horario));
    if (choque) {
      return res.status(400).json({
        error: `El docente ya tiene clase a esa hora (${choque.asignatura} en ${choque.curso})`,
      });
    }
    await pool.query(
      "UPDATE asignaciones SET docente_id = ?, periodo = ?, horario = ? WHERE id = ? AND institucion_id = ?",
      [docenteId, String(periodo).trim(), horario ?? null, id, req.user.institucion_id],
    );
    // Entidad actualizada con el mismo formato del GET.
    const [[row]] = await pool.query(
      `SELECT a.id, a.curso_id, a.asignatura_id, a.periodo, a.horario,
              CONCAT(g.nombre, ' ', c.nombre) AS curso, c.ano_lectivo,
              s.nombre AS asignatura, s.codigo AS asignatura_codigo,
              u.id AS docente_id, u.nombre_completo AS docente,
              (SELECT COUNT(*) FROM matriculas mat WHERE mat.asignacion_id = a.id) AS alumnos
       FROM asignaciones a
       JOIN cursos c ON c.id = a.curso_id
       JOIN grados g ON g.id = c.grado_id
       JOIN asignaturas s ON s.id = a.asignatura_id
       LEFT JOIN usuarios u ON u.id = a.docente_id
       WHERE a.id = ? AND a.institucion_id = ?`,
      [id, req.user.institucion_id],
    );
    res.json(row);
  }),
);

r.delete(
  "/asignaciones/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const [result] = await pool.query(
      "DELETE FROM asignaciones WHERE id = ? AND institucion_id = ?",
      [id, req.user.institucion_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Asignación no encontrada" });
    res.json({ ok: true });
  }),
);

// ---------- Matrículas (anuales por curso) ----------
// El estudiante se matricula al curso del año lectivo y hereda
// automáticamente las asignaturas asignadas a ese curso.
function fechaValida(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

// Matrículas por asignación de un estudiante en un curso (para heredar o
// retirar al matricular/cambiar/cancelar).
async function matriculasDeCurso(estudianteId, cursoId, institucionId) {
  const [rows] = await pool.query(
    `SELECT mat.id AS matricula_id
     FROM matriculas mat
     JOIN asignaciones a ON a.id = mat.asignacion_id
     WHERE mat.estudiante_id = ? AND a.curso_id = ? AND mat.institucion_id = ?`,
    [estudianteId, cursoId, institucionId],
  );
  return rows.map((r) => r.matricula_id);
}

// ¿Alguna de esas matrículas ya tiene notas o asistencia registradas?
// (Si sí, no se pueden retirar en silencio: se bloquea el cambio.)
async function matriculasConRegistros(matriculaIds) {
  if (matriculaIds.length === 0) return 0;
  const marcadores = matriculaIds.map(() => "?").join(",");
  const [[n]] = await pool.query(
    `SELECT COUNT(*) AS total FROM notas
     WHERE matricula_id IN (${marcadores})
       AND (nota_1 IS NOT NULL OR nota_2 IS NOT NULL OR nota_3 IS NOT NULL
         OR examen_final IS NOT NULL OR nota_definitiva IS NOT NULL)`,
    matriculaIds,
  );
  if (n.total > 0) return n.total;
  const [[a]] = await pool.query(
    `SELECT COUNT(*) AS total FROM asistencia WHERE matricula_id IN (${marcadores})`,
    matriculaIds,
  );
  return a.total;
}

// Genera las matrículas por asignación del curso (idempotente).
async function heredarAsignaciones(estudianteId, cursoId, fecha, institucionId) {
  const [asigs] = await pool.query(
    "SELECT id FROM asignaciones WHERE curso_id = ? AND institucion_id = ?",
    [cursoId, institucionId],
  );
  let creadas = 0;
  for (const a of asigs) {
    try {
      await pool.query(
        "INSERT INTO matriculas (estudiante_id, asignacion_id, fecha_matricula, institucion_id) VALUES (?, ?, ?, ?)",
        [estudianteId, a.id, fecha, institucionId],
      );
      creadas++;
    } catch (e) {
      if (e.code !== "ER_DUP_ENTRY") throw e;
    }
  }
  return creadas;
}

r.get(
  "/matriculas",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT mc.id, mc.estudiante_id, u.nombre_completo AS estudiante, u.correo,
            c.id AS curso_id, CONCAT(g.nombre, ' ', c.nombre) AS curso,
            c.ano_lectivo, g.nivel AS grado_nivel, mc.fecha_matricula,
            (SELECT COUNT(*) FROM matriculas mat
              JOIN asignaciones a ON a.id = mat.asignacion_id
             WHERE mat.estudiante_id = mc.estudiante_id AND a.curso_id = mc.curso_id) AS asignaturas
     FROM matriculas_curso mc
     JOIN usuarios u ON u.id = mc.estudiante_id
     JOIN cursos c ON c.id = mc.curso_id
     JOIN grados g ON g.id = c.grado_id
     WHERE mc.institucion_id = ?
     ORDER BY mc.id DESC`,
      [req.user.institucion_id],
    );
    res.json(rows);
  }),
);

r.post(
  "/matriculas",
  asyncHandler(async (req, res) => {
    const { estudiante_id, curso_id, fecha_matricula } = req.body;
    const { institucion_id } = req.user;
    const estudianteId = parseId(estudiante_id);
    const cursoId = parseId(curso_id);
    if (!estudianteId || !cursoId)
      return res.status(400).json({ error: "Faltan datos" });
    if (fecha_matricula != null && fecha_matricula !== "" && !fechaValida(fecha_matricula)) {
      return res.status(400).json({ error: "Fecha inválida" });
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
    const [[cur]] = await pool.query(
      "SELECT id, ano_lectivo FROM cursos WHERE id = ? AND institucion_id = ?",
      [cursoId, institucion_id],
    );
    if (!cur) return res.status(400).json({ error: "El curso no existe" });
    // Un estudiante no se matricula dos veces al mismo curso.
    const [[dup]] = await pool.query(
      "SELECT id FROM matriculas_curso WHERE estudiante_id = ? AND curso_id = ? AND institucion_id = ?",
      [estudianteId, cursoId, institucion_id],
    );
    if (dup) {
      return res.status(400).json({
        error: "El estudiante ya está matriculado en ese curso",
      });
    }
    const fecha = fecha_matricula || new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO matriculas_curso (estudiante_id, curso_id, ano_lectivo, fecha_matricula, institucion_id) VALUES (?, ?, ?, ?, ?)`,
      [estudianteId, cursoId, cur.ano_lectivo, fecha, institucion_id],
    );
    const heredadas = await heredarAsignaciones(estudianteId, cursoId, fecha, institucion_id);
    res.json({ ok: true, id: result.insertId, asignaturas: heredadas });
  }),
);

// Cambia al estudiante de curso (misma matrícula anual). Retira las
// matrículas por asignación del curso anterior solo si no tienen notas ni
// asistencia; si tienen registros, se bloquea para no borrar historia.
r.put(
  "/matriculas/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { curso_id, fecha_matricula } = req.body;
    const { institucion_id } = req.user;
    const cursoId = parseId(curso_id);
    if (!cursoId) return res.status(400).json({ error: "Faltan datos" });
    if (fecha_matricula != null && fecha_matricula !== "" && !fechaValida(fecha_matricula)) {
      return res.status(400).json({ error: "Fecha inválida" });
    }
    const [[mc]] = await pool.query(
      "SELECT id, estudiante_id, curso_id FROM matriculas_curso WHERE id = ? AND institucion_id = ?",
      [id, institucion_id],
    );
    if (!mc) return res.status(404).json({ error: "Matrícula no encontrada" });
    const [[cur]] = await pool.query(
      "SELECT id, ano_lectivo FROM cursos WHERE id = ? AND institucion_id = ?",
      [cursoId, institucion_id],
    );
    if (!cur) return res.status(400).json({ error: "El curso no existe" });
    if (cur.id !== mc.curso_id) {
      const [[dup]] = await pool.query(
        "SELECT id FROM matriculas_curso WHERE estudiante_id = ? AND curso_id = ? AND id <> ? AND institucion_id = ?",
        [mc.estudiante_id, cursoId, id, institucion_id],
      );
      if (dup) {
        return res.status(400).json({
          error: "El estudiante ya está matriculado en ese curso",
        });
      }
      const anteriores = await matriculasDeCurso(mc.estudiante_id, mc.curso_id, institucion_id);
      const conRegistros = await matriculasConRegistros(anteriores);
      if (conRegistros > 0) {
        return res.status(400).json({
          error:
            "No se puede cambiar de curso: el estudiante ya tiene notas o asistencia registradas",
        });
      }
      if (anteriores.length > 0) {
        const marcadores = anteriores.map(() => "?").join(",");
        await pool.query(
          `DELETE FROM matriculas WHERE id IN (${marcadores}) AND institucion_id = ?`,
          [...anteriores, institucion_id],
        );
      }
      await pool.query(
        "UPDATE matriculas_curso SET curso_id = ?, ano_lectivo = ? WHERE id = ? AND institucion_id = ?",
        [cursoId, cur.ano_lectivo, id, institucion_id],
      );
      await heredarAsignaciones(
        mc.estudiante_id,
        cursoId,
        fecha_matricula || new Date().toISOString().slice(0, 10),
        institucion_id,
      );
    }
    if (fecha_matricula) {
      await pool.query(
        "UPDATE matriculas_curso SET fecha_matricula = ? WHERE id = ? AND institucion_id = ?",
        [fecha_matricula, id, institucion_id],
      );
    }
    // Entidad actualizada con el mismo formato del GET.
    const [[row]] = await pool.query(
      `SELECT mc.id, mc.estudiante_id, u.nombre_completo AS estudiante, u.correo,
              c.id AS curso_id, CONCAT(g.nombre, ' ', c.nombre) AS curso,
              c.ano_lectivo, g.nivel AS grado_nivel, mc.fecha_matricula,
              (SELECT COUNT(*) FROM matriculas mat
                JOIN asignaciones a ON a.id = mat.asignacion_id
               WHERE mat.estudiante_id = mc.estudiante_id AND a.curso_id = mc.curso_id) AS asignaturas
       FROM matriculas_curso mc
       JOIN usuarios u ON u.id = mc.estudiante_id
       JOIN cursos c ON c.id = mc.curso_id
       JOIN grados g ON g.id = c.grado_id
       WHERE mc.id = ? AND mc.institucion_id = ?`,
      [id, institucion_id],
    );
    res.json(row);
  }),
);

r.delete(
  "/matriculas/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { institucion_id } = req.user;
    const [[mc]] = await pool.query(
      "SELECT id, estudiante_id, curso_id FROM matriculas_curso WHERE id = ? AND institucion_id = ?",
      [id, institucion_id],
    );
    if (!mc) return res.status(404).json({ error: "Matrícula no encontrada" });
    const anteriores = await matriculasDeCurso(mc.estudiante_id, mc.curso_id, institucion_id);
    const conRegistros = await matriculasConRegistros(anteriores);
    if (conRegistros > 0) {
      return res.status(400).json({
        error:
          "No se puede retirar la matrícula: el estudiante ya tiene notas o asistencia registradas",
      });
    }
    if (anteriores.length > 0) {
      const marcadores = anteriores.map(() => "?").join(",");
      await pool.query(
        `DELETE FROM matriculas WHERE id IN (${marcadores}) AND institucion_id = ?`,
        [...anteriores, institucion_id],
      );
    }
    await pool.query(
      "DELETE FROM matriculas_curso WHERE id = ? AND institucion_id = ?",
      [id, institucion_id],
    );
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
