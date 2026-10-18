import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { cargarResumenGrupo, construirRango } from "../lib/asistencia.js";
import {
  buildCsv,
  buildPdf,
  buildXlsxBuffer,
  nombreArchivo as nombreArchivoReporte,
} from "../lib/reportesAsistencia.js";
import { notificar } from "../lib/notificar.js";

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

function hoyLocal() {
  return new Date().toISOString().slice(0, 10);
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
    const [[a]] = await pool.query(
      "SELECT id FROM asignaciones WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (!a) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }
  const [[a]] = await pool.query(
    "SELECT id FROM asignaciones WHERE id = ? AND docente_id = ?",
    [grupoId, req.user.id],
  );
  if (!a) {
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
       JOIN asignaciones a ON a.id = mat.asignacion_id
       WHERE mat.estudiante_id = ? AND a.docente_id = ?
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

// Upsert de marcas de asistencia con trazabilidad: estampa quién marcó y cuándo,
// exige justificación al editar días pasados y deja constancia en la bitácora.
// Debe correr dentro de una transacción (recibe la conexión). A devuelve los
// archivos de excusa que deben eliminarse del disco tras el commit.
async function aplicarRegistros(conn, { registros, fecha, justificacion, usuarioId }) {
  const hoy = hoyLocal();
  const justificacionFinal =
    typeof justificacion === "string" && justificacion.trim() ? justificacion.trim() : null;
  const archivosEliminar = [];

  for (const reg of registros) {
    if (!reg.matricula_id || !ESTADOS.includes(reg.estado)) {
      const err = new Error("Registro inválido");
      err.status = 400;
      throw err;
    }
    const [[prev]] = await conn.query(
      `SELECT estado, observacion, archivo_ruta
       FROM asistencia WHERE matricula_id = ? AND fecha = ?`,
      [reg.matricula_id, fecha],
    );
    const estadoNuevo = reg.estado;
    const observacion = reg.observacion ?? null;

    // Editar una marca de un día anterior (cambio de estado u observación)
    // exige una justificación; los marcados del día actual no la necesitan.
    let requiereJustificacion = false;
    if (prev && fecha < hoy) {
      const cambioEstado = prev.estado !== estadoNuevo;
      const cambioObservacion = (prev.observacion ?? null) !== observacion;
      requiereJustificacion = cambioEstado || cambioObservacion;
    }
    if (requiereJustificacion && !justificacionFinal) {
      const err = new Error(
        "Se requiere una justificación al editar la asistencia de días anteriores",
      );
      err.status = 400;
      throw err;
    }

    // Si deja de ser excusa se descarta el soporte adjunto asociado.
    if (estadoNuevo !== "excusa" && prev?.archivo_ruta) {
      archivosEliminar.push(prev.archivo_ruta);
    }

    await conn.query(
      `INSERT INTO asistencia (matricula_id, fecha, estado, observacion,
                               archivo_ruta, archivo_mime, archivo_nombre,
                               marcado_por, hora_marcado)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NOW())
       ON DUPLICATE KEY UPDATE
         estado = VALUES(estado),
         observacion = VALUES(observacion),
         archivo_ruta = IF(VALUES(estado) = 'excusa', asistencia.archivo_ruta, NULL),
         archivo_mime = IF(VALUES(estado) = 'excusa', asistencia.archivo_mime, NULL),
         archivo_nombre = IF(VALUES(estado) = 'excusa', asistencia.archivo_nombre, NULL),
         marcado_por = VALUES(marcado_por),
         hora_marcado = VALUES(hora_marcado)`,
      [reg.matricula_id, fecha, estadoNuevo, observacion, usuarioId],
    );

    // Auditoría: se registra todo cambio de estado y toda edición justificada.
    if (prev && (prev.estado !== estadoNuevo || requiereJustificacion)) {
      await conn.query(
        `INSERT INTO asistencia_audit
           (matricula_id, fecha, estado_anterior, estado_nuevo, justificacion, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [reg.matricula_id, fecha, prev.estado, estadoNuevo, justificacionFinal, usuarioId],
      );
    }
  }

  return { archivosEliminar };
}

// Registro de asistencia de un grupo en una fecha (la de hoy por defecto).
r.get("/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;
  const qFecha = String(req.query.fecha ?? "");
  const fecha = fechaValida(qFecha) ? qFecha : hoyLocal();
  const [rows] = await pool.query(
    `SELECT mat.id AS matricula_id, u.id AS estudiante_id,
            u.nombre_completo AS estudiante, u.correo, u.foto_url, u.codigo_carnet,
            a.id AS asistencia_id, a.fecha, a.estado, a.observacion,
            a.archivo_ruta, a.archivo_mime, a.archivo_nombre
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id AND a.fecha = ?
     WHERE mat.asignacion_id = ?
     ORDER BY u.nombre_completo`,
    [fecha, grupoId],
  );
  res.json({ fecha, registros: rows });
}));

// Registra el ingreso de un estudiante escaneando su carné (QR o lector USB).
r.post("/escaneo", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.body.grupo_id);
  const fecha = String(req.body.fecha ?? "");
  const codigo = String(req.body.codigo_carnet ?? "").trim();
  if (!grupoId || !fechaValida(fecha) || !codigo) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  if (!(await puedeVerGrupo(req, res, grupoId))) return;

  const [[mat]] = await pool.query(
    `SELECT mat.id AS matricula_id, u.id AS estudiante_id, u.nombre_completo AS estudiante
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     WHERE mat.asignacion_id = ? AND u.codigo_carnet = ?`,
    [grupoId, codigo],
  );
  if (!mat) {
    return res.status(404).json({ error: "Carné no encontrado en esta clase" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await aplicarRegistros(conn, {
      registros: [{ matricula_id: mat.matricula_id, estado: "presente", observacion: null }],
      fecha,
      usuarioId: req.user.id,
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    conn.release();
    if (e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
  conn.release();

  res.json({ ok: true, estudiante: mat.estudiante });
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
    `SELECT m.id, m.institucion_id, a.docente_id
     FROM matriculas m
     JOIN asignaciones a ON a.id = m.asignacion_id
     WHERE m.id = ?`,
    [matriculaId],
  );
  if (!mat) return res.status(404).json({ error: "Matrícula no encontrada" });
  if (req.user.rol === "admin") {
    if (mat.institucion_id !== req.user.institucion_id) {
      return res.status(403).json({ error: "No autorizado" });
    }
  } else if (mat.docente_id !== req.user.id) {
    return res.status(403).json({ error: "No autorizado" });
  }

  // Si ya existía un adjunto y se va a reemplazar, se borra del disco.
  const [[prev]] = await pool.query(
    "SELECT estado, archivo_ruta FROM asistencia WHERE matricula_id = ? AND fecha = ?",
    [matriculaId, fecha],
  );
  const archivoNuevo = req.file ?? null;
  if (archivoNuevo && prev?.archivo_ruta) await eliminarArchivo(prev.archivo_ruta);

  await pool.query(
    `INSERT INTO asistencia (matricula_id, fecha, estado, observacion,
                             archivo_ruta, archivo_mime, archivo_nombre,
                             marcado_por, hora_marcado)
     VALUES (?, ?, 'excusa', ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       estado = 'excusa',
       observacion = VALUES(observacion),
       archivo_ruta = IF(VALUES(archivo_ruta) IS NULL, asistencia.archivo_ruta, VALUES(archivo_ruta)),
       archivo_mime = IF(VALUES(archivo_mime) IS NULL, asistencia.archivo_mime, VALUES(archivo_mime)),
       archivo_nombre = IF(VALUES(archivo_nombre) IS NULL, asistencia.archivo_nombre, VALUES(archivo_nombre)),
       marcado_por = VALUES(marcado_por),
       hora_marcado = VALUES(hora_marcado)`,
    [
      matriculaId,
      fecha,
      observacion,
      archivoNuevo ? archivoNuevo.filename : null,
      archivoNuevo ? archivoNuevo.mimetype : null,
      archivoNuevo ? archivoNuevo.originalname : null,
      req.user.id,
    ],
  );

  // Auditoría: pasar a 'excusa' desde otro estado queda registrado.
  if (prev && prev.estado !== "excusa") {
    await pool.query(
      `INSERT INTO asistencia_audit
         (matricula_id, fecha, estado_anterior, estado_nuevo, justificacion, usuario_id)
       VALUES (?, ?, ?, 'excusa', ?, ?)`,
      [matriculaId, fecha, prev.estado, observacion, req.user.id],
    );
  }

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
    `SELECT a.archivo_ruta, a.archivo_nombre, m.institucion_id, g.docente_id
     FROM asistencia a
     JOIN matriculas m ON m.id = a.matricula_id
     JOIN asignaciones g ON g.id = m.asignacion_id
     WHERE a.matricula_id = ? AND a.fecha = ?`,
    [matriculaId, fecha],
  );
  if (!a?.archivo_ruta) return res.status(404).json({ error: "No hay excusa adjunta" });
  if (req.user.rol === "admin") {
    if (a.institucion_id !== req.user.institucion_id) {
      return res.status(403).json({ error: "No autorizado" });
    }
  } else if (a.docente_id !== req.user.id) {
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
  const { grupo_id, fecha, registros, justificacion } = req.body;
  const grupoId = parseId(grupo_id);
  if (!grupoId || !fecha || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  if (!fechaValida(fecha)) {
    return res.status(400).json({ error: "Fecha inválida" });
  }
  if (req.user.rol === "admin") {
    const [[a]] = await pool.query(
      "SELECT id FROM asignaciones WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (!a) return res.status(403).json({ error: "No autorizado" });
  } else {
    const [[a]] = await pool.query(
      "SELECT id FROM asignaciones WHERE id = ? AND docente_id = ?",
      [grupoId, req.user.id],
    );
    if (!a) return res.status(403).json({ error: "No autorizado" });
  }

  // Cada matrícula debe pertenecer a la clase (evita inyectar asistencia ajena)
  // y no puede repetirse dentro de la lista.
  const ids = registros.map((reg) => Number(reg.matricula_id));
  const idsValidos = ids.every((n) => Number.isInteger(n) && n > 0);
  if (!idsValidos || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "Registro inválido" });
  }
  const marcadores = ids.map(() => "?").join(", ");
  const [pertenecientes] = await pool.query(
    `SELECT id FROM matriculas WHERE asignacion_id = ? AND id IN (${marcadores})`,
    [grupoId, ...ids],
  );
  if (pertenecientes.length !== ids.length) {
    return res.status(400).json({
      error: "Uno o más estudiantes no pertenecen a esta clase",
    });
  }

  const conn = await pool.getConnection();
  let archivosEliminar = [];
  try {
    await conn.beginTransaction();
    const resultado = await aplicarRegistros(conn, {
      registros,
      fecha,
      justificacion,
      usuarioId: req.user.id,
    });
    archivosEliminar = resultado.archivosEliminar;
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    conn.release();
    if (e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
  conn.release();
  for (const archivo of archivosEliminar) {
    await eliminarArchivo(archivo);
  }
  res.json({ ok: true, fecha, guardados: registros.length });
}));

// Notifica por inasistencia a los estudiantes elegidos y a sus acudientes.
r.post("/alerta/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;

  const ids = Array.isArray(req.body.estudiante_ids) ? req.body.estudiante_ids.map(Number) : [];
  if (ids.length === 0 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
    return res.status(400).json({ error: "Debes elegir al menos un estudiante" });
  }
  const unicos = [...new Set(ids)];

  const [[grupo]] = await pool.query(
    `SELECT CONCAT(gr.nombre, ' ', c.nombre) AS codigo_grupo, s.nombre AS materia
     FROM asignaciones a
     JOIN cursos c ON c.id = a.curso_id
     JOIN grados gr ON gr.id = c.grado_id
     JOIN asignaturas s ON s.id = a.asignatura_id
     WHERE a.id = ?`,
    [grupoId],
  );
  if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });

  const marcadores = unicos.map(() => "?").join(", ");
  const [pertenecientes] = await pool.query(
    `SELECT u.id AS estudiante_id
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     WHERE mat.asignacion_id = ? AND u.id IN (${marcadores})`,
    [grupoId, ...unicos],
  );
  if (pertenecientes.length !== unicos.length) {
    return res.status(400).json({ error: "Uno o más estudiantes no pertenecen a esta clase" });
  }

  const mensajeEstudiante =
    `Tu asistencia en ${grupo.materia} (${grupo.codigo_grupo}) está en riesgo. ` +
    "Revisa tu planilla de asistencia y ponte al día.";
  const mensajeAcudiente =
    `La asistencia de tu acudido en ${grupo.materia} (${grupo.codigo_grupo}) está en riesgo. ` +
    "Se recomienda contacto con la coordinación académica.";

  for (const estudianteId of unicos) {
    await notificar(estudianteId, "Alerta de asistencia", mensajeEstudiante, "sistema");
    const [acudientes] = await pool.query(
      "SELECT acudiente_id FROM acudiente_estudiante WHERE estudiante_id = ?",
      [estudianteId],
    );
    for (const a of acudientes) {
      await notificar(a.acudiente_id, "Alerta de asistencia", mensajeAcudiente, "sistema");
    }
  }

  res.json({ ok: true, notificados: unicos.length });
}));

// Resumen histórico consolidado de asistencia por estudiante para un grupo.
// Usa la misma semántica que /resumen/estudiante: fallas = ausentes + tardes,
// porcentaje sobre registros con estado (excluye fechas sin marcar).
// Acepta un rango opcional ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (sin filtro se
// devuelve el histórico completo) e incluye nivel de riesgo por estudiante.
r.get("/resumen/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;

  const { desde, hasta } = req.query;
  const resumen = await cargarResumenGrupo(grupoId, { desde, hasta });
  if (!resumen) {
    const invalido = construirRango(desde, hasta);
    return res.status(400).json({ error: invalido.error || "Rango de fechas inválido" });
  }
  res.json(resumen);
}));

// Resumen global de asistencia y fallas por asignatura de un estudiante.
// Un docente solo ve las asignaturas que dicta a ese estudiante (sin fuga entre
// asignaturas/cursos); admin y el propio estudiante ven el histórico completo.
r.get("/resumen/estudiante/:estudiante_id", asyncHandler(async (req, res) => {
  const estudianteId = parseId(req.params.estudiante_id);
  if (!estudianteId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerEstudiante(req, res, estudianteId))) return;
  const params = [estudianteId];
  const filtroProfesor =
    req.user.rol === "profesor" ? " AND a.docente_id = ?" : "";
  if (filtroProfesor) params.push(req.user.id);
  const [rows] = await pool.query(
    `SELECT s.nombre AS materia, COALESCE(aa.estado, 'sin_registro') AS estado, COUNT(*) AS total
     FROM matriculas mat
     JOIN asignaciones a ON a.id = mat.asignacion_id
     JOIN asignaturas s ON s.id = a.asignatura_id
     LEFT JOIN asistencia aa ON aa.matricula_id = mat.id
     WHERE mat.estudiante_id = ?${filtroProfesor}
     GROUP BY s.nombre, aa.estado
     ORDER BY s.nombre`,
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

// Reporte JSON de un grupo: grupo, estudiantes y totales con semáforo de riesgo.
r.get("/reportes/grupo/:grupo_id", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;
  const { desde, hasta } = req.query;
  const resumen = await cargarResumenGrupo(grupoId, { desde, hasta });
  if (!resumen) return res.status(400).json({ error: "Rango de fechas inválido" });
  res.json(resumen);
}));

// Exportación del reporte en xlsx o csv (Con BOM). Otros formatos → 400.
r.get("/reportes/grupo/:grupo_id/exportar", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;

  const formato = String(req.query.formato ?? "xlsx");
  const { desde, hasta } = req.query;
  const resumen = await cargarResumenGrupo(grupoId, { desde, hasta });
  if (!resumen) return res.status(400).json({ error: "Rango de fechas inválido" });

  if (formato === "xlsx") {
    const buffer = buildXlsxBuffer(resumen);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivoReporte(resumen.grupo, resumen.desde, resumen.hasta, "xlsx")}"`,
    );
    return res.send(buffer);
  }
  if (formato === "csv") {
    const csv = buildCsv(resumen);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivoReporte(resumen.grupo, resumen.desde, resumen.hasta, "csv")}"`,
    );
    return res.send(csv);
  }
  res.status(400).json({ error: "Formato no soportado. Usa xlsx o csv" });
}));

// Reporte en PDF con membrete de la institución y desglose de fallas.
r.get("/reportes/grupo/:grupo_id/pdf", asyncHandler(async (req, res) => {
  const grupoId = parseId(req.params.grupo_id);
  if (!grupoId) return res.status(400).json({ error: "ID inválido" });
  if (!(await puedeVerGrupo(req, res, grupoId))) return;
  const { desde, hasta } = req.query;
  const resumen = await cargarResumenGrupo(grupoId, { desde, hasta });
  if (!resumen) return res.status(400).json({ error: "Rango de fechas inválido" });

  const buffer = await buildPdf(resumen);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${nombreArchivoReporte(resumen.grupo, resumen.desde, resumen.hasta, "pdf")}"`,
  );
  res.send(buffer);
}));

// Panel administrativo de análisis preventivo: agregados por asignación.
r.get("/panorama", asyncHandler(async (req, res) => {
  if (req.user.rol !== "admin") {
    return res.status(403).json({ error: "No autorizado" });
  }
  const { desde, hasta, grupo_id } = req.query;
  const rango = construirRango(desde, hasta);
  if (rango.error) return res.status(400).json({ error: rango.error });

  const params = [req.user.institucion_id];
  let filtroGrupo = "";
  if (grupo_id && parseId(grupo_id)) {
    filtroGrupo = " AND a.id = ?";
    params.push(parseId(grupo_id));
  }
  const [grupos] = await pool.query(
    `SELECT a.id FROM asignaciones a WHERE a.institucion_id = ?${filtroGrupo} ORDER BY a.id`,
    params,
  );

  const filas = [];
  for (const grupo of grupos) {
    const resumen = await cargarResumenGrupo(grupo.id, { desde, hasta });
    if (!resumen) continue;
    filas.push({
      id: resumen.grupo.id,
      codigo_grupo: resumen.grupo.codigo_grupo,
      materia: resumen.grupo.materia,
      materia_codigo: resumen.grupo.materia_codigo,
      periodo: resumen.grupo.periodo,
      horario: resumen.grupo.horario,
      alumnos: resumen.estudiantes.length,
      totales: resumen.totales,
    });
  }

  res.json({ grupos: filas, desde: rango.desde, hasta: rango.hasta });
}));

export default r;