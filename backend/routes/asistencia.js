import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken);

const ESTADOS = ["presente", "ausente", "tarde", "excusa"];
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
const CARPETA_EXCUSAS = path.join(process.cwd(), "uploads", "excusas");

mkdirSync(CARPETA_EXCUSAS, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, CARPETA_EXCUSAS);
  },
  filename(_req, file, cb) {
    cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
  },
});

const uploadExcusa = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (MIME_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    const err = new Error("El archivo debe ser PDF, JPG o PNG");
    err.status = 400;
    cb(err);
  },
});

// Envuelve multer para traducir sus errores a respuestas 4xx en español.
function subirArchivo(req, res, next) {
  uploadExcusa.single("archivo")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ error: "El archivo supera el tamaño máximo permitido (5 MB)" });
      }
      return res.status(err.status ?? 400).json({
        error: err.message || "Error al subir el archivo",
      });
    }
    next();
  });
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function fechaValida(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function rutaDisco(nombre) {
  if (!nombre || typeof nombre !== "string") return null;
  return path.join(CARPETA_EXCUSAS, path.basename(nombre));
}

async function eliminarArchivo(nombre) {
  const ruta = rutaDisco(nombre);
  if (!ruta) return;
  try {
    await unlink(ruta);
  } catch (err) {
    if (err.code !== "ENOENT") console.error("No se pudo eliminar el adjunto:", err.message);
  }
}

async function puedeVerGrupo(req, res, grupoId) {
  if (req.user.rol === "admin") {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (!g) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  const [[g]] = await pool.query(
    "SELECT id FROM grupos WHERE id = ? AND profesor_id = ?",
    [grupoId, req.user.id],
  );
  if (!g) {
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  return true;
}

async function puedeVerEstudiante(req, res, estudianteId) {
  const { rol, id, institucion_id } = req.user;
  if (rol === "admin") {
    const [[est]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND institucion_id = ?",
      [estudianteId, institucion_id],
    );
    if (!est) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  if (rol === "estudiante") {
    if (id !== estudianteId) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  if (rol === "profesor") {
    const [[p]] = await pool.query(
      `SELECT mat.id FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       WHERE mat.estudiante_id = ? AND g.profesor_id = ?
       LIMIT 1`,
      [estudianteId, id],
    );
    if (!p) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  res.status(403).json({ error: "Prohibido" });
  return false;
}

// Registro de asistencia de un grupo en una fecha (la de hoy por defecto).
r.get("/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;
  const qFecha = String(req.query.fecha ?? "");
  const fecha = fechaValida(qFecha) ? qFecha : new Date().toISOString().slice(0, 10);
  const [rows] = await pool.query(
    `SELECT mat.id AS matricula_id, u.id AS estudiante_id,
            u.nombre_completo AS estudiante, u.correo, u.foto_url,
            a.id AS asistencia_id, a.fecha, a.estado, a.observacion,
            a.archivo_ruta, a.archivo_mime, a.archivo_nombre
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id AND a.fecha = ?
     WHERE mat.grupo_id = ?
     ORDER BY u.nombre_completo`,
    [fecha, grupoId],
  );
  res.json({ fecha, registros: rows });
}));

// Adjunta (o reemplaza) el soporte de la excusa de un estudiante en una fecha.
r.post("/excusa", subirArchivo, asyncHandler(async (req, res) => {
  const matriculaId = parseId(req.body.matricula_id);
  const fecha = String(req.body.fecha ?? "");
  if (!matriculaId || !fechaValida(fecha)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const observacion =
    typeof req.body.observacion === "string" && req.body.observacion.trim()
      ? req.body.observacion.trim()
      : null;

  const [[mat]] = await pool.query(
    `SELECT m.id, m.institucion_id, g.profesor_id
     FROM matriculas m
     JOIN grupos g ON g.id = m.grupo_id
     WHERE m.id = ?`,
    [matriculaId],
  );
  if (!mat) return res.status(404).json({ error: "Matrícula no encontrada" });
  if (req.user.rol === "admin") {
    if (mat.institucion_id !== req.user.institucion_id) {
      return res.status(403).json({ error: "No autorizado" });
    }
  } else if (mat.profesor_id !== req.user.id) {
    return res.status(403).json({ error: "No autorizado" });
  }

  // Si ya existía un adjunto y se va a reemplazar, se borra del disco.
  const archivoNuevo = req.file ?? null;
  if (archivoNuevo) {
    const [[prev]] = await pool.query(
      "SELECT archivo_ruta FROM asistencia WHERE matricula_id = ? AND fecha = ?",
      [matriculaId, fecha],
    );
    if (prev?.archivo_ruta) await eliminarArchivo(prev.archivo_ruta);
  }

  await pool.query(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion,
                             archivo_ruta, archivo_mime, archivo_nombre)
     VALUES (?, ?, 'excusa', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       estado = 'excusa',
       observacion = VALUES(observacion),
       archivo_ruta = IF(VALUES(archivo_ruta) IS NULL, asistencia.archivo_ruta, VALUES(archivo_ruta)),
       archivo_mime = IF(VALUES(archivo_mime) IS NULL, asistencia.archivo_mime, VALUES(archivo_mime)),
       archivo_nombre = IF(VALUES(archivo_nombre) IS NULL, asistencia.archivo_nombre, VALUES(archivo_nombre))`,
    [
      matriculaId,
      fecha,
      observacion,
      archivoNuevo ? archivoNuevo.filename : null,
      archivoNuevo ? archivoNuevo.mimetype : null,
      archivoNuevo ? archivoNuevo.originalname : null,
    ],
  );

  res.json({ ok: true, fecha });
}));

// Descarga el soporte adjunto de la excusa de una matrícula en una fecha.
r.get("/excusa/descargar", asyncHandler(async (req, res) => {
  const matriculaId = parseId(req.query.matricula_id);
  const fecha = String(req.query.fecha ?? "");
  if (!matriculaId || !fechaValida(fecha)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }
  const [[a]] = await pool.query(
    `SELECT a.archivo_ruta, a.archivo_nombre, m.institucion_id, g.profesor_id
     FROM asistencia a
     JOIN matriculas m ON m.id = a.matricula_id
     JOIN grupos g ON g.id = m.grupo_id
     WHERE a.matricula_id = ? AND a.fecha = ?`,
    [matriculaId, fecha],
  );
  if (!a?.archivo_ruta) return res.status(404).json({ error: "No hay excusa adjunta" });
  if (req.user.rol === "admin") {
    if (a.institucion_id !== req.user.institucion_id) {
      return res.status(403).json({ error: "No autorizado" });
    }
  } else if (a.profesor_id !== req.user.id) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const ruta = rutaDisco(a.archivo_ruta);
  if (!ruta) return res.status(404).json({ error: "Archivo no encontrado" });
  res.download(ruta, a.archivo_nombre || `excusa${path.extname(a.archivo_ruta)}`, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "Archivo no encontrado" });
    }
  });
}));

// Guarda la lista de asistencia del día para un grupo (arreglo de estudiantes).
r.post("/registrar", asyncHandler(async (req, res) => {
  const { grupo_id, fecha, registros } = req.body;
  const grupoId = parseId(grupo_id);
  if (!grupoId || !fecha || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  if (!fechaValida(fecha)) {
    return res.status(400).json({ error: "Fecha inválida" });
  }
  if (req.user.rol === "admin") {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (!g) return res.status(403).json({ error: "No autorizado" });
  } else {
    const [[g]] = await pool.query(
      "SELECT id FROM grupos WHERE id = ? AND profesor_id = ?",
      [grupoId, req.user.id],
    );
    if (!g) return res.status(403).json({ error: "No autorizado" });
  }

  // Cada matrícula debe pertenecer al grupo (evita inyectar asistencia ajena)
  // y no puede repetirse dentro de la lista.
  const ids = registros.map((reg) => Number(reg.matricula_id));
  const idsValidos = ids.every((n) => Number.isInteger(n) && n > 0);
  if (!idsValidos || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "Registro inválido" });
  }
  const marcadores = ids.map(() => "?").join(", ");
  const [pertenecientes] = await pool.query(
    `SELECT id FROM matriculas WHERE grupo_id = ? AND id IN (${marcadores})`,
    [grupoId, ...ids],
  );
  if (pertenecientes.length !== ids.length) {
    return res.status(400).json({
      error: "Uno o más estudiantes no pertenecen a este grupo",
    });
  }

  const conn = await pool.getConnection();
  const archivosEliminar = [];
  try {
    await conn.beginTransaction();
    for (const reg of registros) {
      if (!reg.matricula_id || !ESTADOS.includes(reg.estado)) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: "Registro inválido" });
      }
      // Si deja de ser excusa se descarta el soporte adjunto asociado.
      if (reg.estado !== "excusa") {
        const [[prev]] = await conn.query(
          "SELECT archivo_ruta FROM asistencia WHERE matricula_id = ? AND fecha = ?",
          [reg.matricula_id, fecha],
        );
        if (prev?.archivo_ruta) archivosEliminar.push(prev.archivo_ruta);
      }
      await conn.query(
        `INSERT INTO asistencia (matricula_id, fecha, estado, observacion,
                                 archivo_ruta, archivo_mime, archivo_nombre)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL)
         ON DUPLICATE KEY UPDATE
           estado = VALUES(estado),
           observacion = VALUES(observacion),
           archivo_ruta = IF(VALUES(estado) = 'excusa', asistencia.archivo_ruta, NULL),
           archivo_mime = IF(VALUES(estado) = 'excusa', asistencia.archivo_mime, NULL),
           archivo_nombre = IF(VALUES(estado) = 'excusa', asistencia.archivo_nombre, NULL)`,
        [reg.matricula_id, fecha, reg.estado, reg.observacion ?? null],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  for (const archivo of archivosEliminar) {
    await eliminarArchivo(archivo);
  }
  res.json({ ok: true, fecha, guardados: registros.length });
}));

// Resumen histórico consolidado de asistencia por estudiante para un grupo.
// Usa la misma semántica que /resumen/estudiante: fallas = ausentes + tardes,
// porcentaje sobre registros con estado (excluye fechas sin marcar).
// Acepta un rango opcional ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (sin filtro se
// devuelve el histórico completo) e incluye el detalle por sesión en `registros`.
r.get("/resumen/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;

  const { desde, hasta } = req.query;
  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) {
    return res.status(400).json({ error: "Rango de fechas inválido" });
  }
  if (desde && hasta && String(desde) > String(hasta)) {
    return res.status(400).json({ error: "La fecha 'desde' no puede ser mayor que 'hasta'" });
  }
  let condicionRango = "";
  const paramsRango = [];
  if (desde && hasta) {
    condicionRango = " AND a.fecha BETWEEN ? AND ?";
    paramsRango.push(String(desde), String(hasta));
  } else if (desde) {
    condicionRango = " AND a.fecha >= ?";
    paramsRango.push(String(desde));
  } else if (hasta) {
    condicionRango = " AND a.fecha <= ?";
    paramsRango.push(String(hasta));
  }

  // Un registro por estudiante y fecha de sesión. El rango se aplica sobre el
  // LEFT JOIN de asistencia: los estudiantes sin marcas en el rango siguen
  // apareciendo, solo que con `registros` vacío.
  const [rows] = await pool.query(
    `SELECT u.id AS estudiante_id, u.nombre_completo AS estudiante,
            u.correo, u.foto_url, a.fecha, a.estado, a.observacion
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id${condicionRango}
     WHERE mat.grupo_id = ?
     ORDER BY u.nombre_completo, a.fecha DESC`,
    [...paramsRango, grupoId],
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.estudiante_id)) {
      map.set(row.estudiante_id, {
        estudiante_id: row.estudiante_id,
        estudiante: row.estudiante,
        correo: row.correo,
        foto_url: row.foto_url,
        presentes: 0,
        ausentes: 0,
        tardes: 0,
        excusas: 0,
        total: 0,
        registros: [],
      });
    }
    const e = map.get(row.estudiante_id);
    if (!row.estado) continue; // matrícula sin asistencia en el rango
    if (row.estado === "presente") e.presentes += 1;
    else if (row.estado === "ausente") e.ausentes += 1;
    else if (row.estado === "tarde") e.tardes += 1;
    else if (row.estado === "excusa") e.excusas += 1;
    e.registros.push({
      fecha: row.fecha,
      estado: row.estado,
      observacion: row.observacion,
    });
  }

  const estudiantes = [...map.values()].map((e) => {
    const registrados = e.presentes + e.ausentes + e.tardes + e.excusas;
    e.total = registrados;
    return {
      ...e,
      fallas: e.ausentes + e.tardes,
      porcentaje: registrados > 0 ? Math.round((e.presentes / registrados) * 100) : null,
    };
  });

  res.json({ estudiantes, desde: desde ?? null, hasta: hasta ?? null });
}));

// Resumen global de asistencia y fallas por materia de un estudiante.
// Un profesor solo ve las materias que dicta a ese estudiante (sin fuga entre
// materias/carreras); admin y el propio estudiante ven el histórico completo.
r.get("/resumen/estudiante/:estudiante_id", asyncHandler(async (req, res) => {
  const estudianteId = parseId(req.params.estudiante_id);
  if (!estudianteId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerEstudiante(req, res, estudianteId))) return;
  const params = [estudianteId];
  const filtroProfesor =
    req.user.rol === "profesor" ? " AND g.profesor_id = ?" : "";
  if (filtroProfesor) params.push(req.user.id);
  const [rows] = await pool.query(
    `SELECT m.nombre AS materia, COALESCE(a.estado, 'sin_registro') AS estado, COUNT(*) AS total
     FROM matriculas mat
     JOIN grupos g ON g.id = mat.grupo_id
     JOIN materias m ON m.id = g.materia_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id
     WHERE mat.estudiante_id = ?${filtroProfesor}
     GROUP BY m.nombre, a.estado
     ORDER BY m.nombre`,
    params,
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.materia)) {
      map.set(row.materia, { presentes: 0, ausentes: 0, tardes: 0, excusas: 0, sin_registro: 0, total: 0 });
    }
    const m = map.get(row.materia);
    m.total += row.total;
    if (row.estado === "presente") m.presentes += row.total;
    else if (row.estado === "ausente") m.ausentes += row.total;
    else if (row.estado === "tarde") m.tardes += row.total;
    else if (row.estado === "excusa") m.excusas += row.total;
    else m.sin_registro += row.total;
  }

  const porMateria = [...map.entries()].map(([materia, m]) => {
    const registrados = m.presentes + m.ausentes + m.tardes + m.excusas;
    return {
      materia,
      presentes: m.presentes,
      ausentes: m.ausentes,
      tardes: m.tardes,
      excusas: m.excusas,
      total: registrados,
      fallas: m.ausentes + m.tardes,
      porcentaje: registrados > 0 ? Math.round((m.presentes / registrados) * 100) : null,
    };
  });

  const totalRegistros = porMateria.reduce((s, m) => s + m.total, 0);
  const presentes = porMateria.reduce((s, m) => s + m.presentes, 0);
  const ausentes = porMateria.reduce((s, m) => s + m.ausentes, 0);
  const tardes = porMateria.reduce((s, m) => s + m.tardes, 0);
  const excusas = porMateria.reduce((s, m) => s + m.excusas, 0);

  res.json({
    total_registros: totalRegistros,
    presentes,
    ausentes,
    tardes,
    excusas,
    porcentaje_asistencia: totalRegistros > 0 ? Math.round((presentes / totalRegistros) * 100) : 0,
    total_fallas: ausentes + tardes,
    por_materia: porMateria,
  });
}));

export default r;