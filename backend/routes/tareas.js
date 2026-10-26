import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notificar } from "../lib/notificar.js";
import {
  COLUMNAS_NOTA,
  PUNTAJE_MAX_TAREA,
  recalcularCasillero,
} from "../lib/notasTareas.js";
import {
  EXTENSIONES_ENTREGA,
  TAMANO_MAX_ENTREGA,
  esEntregaTardia,
  extensionPermitida,
  nombreOriginalSeguro,
} from "../lib/archivosEntrega.js";

const r = Router();
r.use(verifyToken);

// ---------- Adjuntos de las entregas ----------
const CARPETA_ENTREGAS = path.join(process.cwd(), "uploads", "entregas");
mkdirSync(CARPETA_ENTREGAS, { recursive: true });

const storageEntrega = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, CARPETA_ENTREGAS);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const uploadEntrega = multer({
  storage: storageEntrega,
  limits: { fileSize: TAMANO_MAX_ENTREGA },
  fileFilter(_req, file, cb) {
    if (extensionPermitida(file.originalname)) return cb(null, true);
    const err = new Error(`Formato no permitido. Usa: ${EXTENSIONES_ENTREGA.join(", ")}`);
    err.status = 400;
    cb(err);
  },
});

const TAMANO_MAX_MB = Math.round(TAMANO_MAX_ENTREGA / (1024 * 1024));

// Envuelve multer para traducir sus errores a respuestas 4xx en español.
function subirArchivoEntrega(req, res, next) {
  uploadEntrega.single("archivo")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          error:
            err.code === "LIMIT_FILE_SIZE"
              ? `El archivo supera el tamaño máximo permitido (${TAMANO_MAX_MB} MB)`
              : "No se pudo subir el archivo",
        });
      }
      return res.status(err.status ?? 400).json({
        error: err.message || "Error al subir el archivo",
      });
    }
    next();
  });
}

function rutaDiscoEntrega(nombre) {
  if (!nombre || typeof nombre !== "string") return null;
  return path.join(CARPETA_ENTREGAS, path.basename(nombre));
}

async function eliminarArchivoEntrega(nombre) {
  const ruta = rutaDiscoEntrega(nombre);
  if (!ruta) return;
  try {
    await unlink(ruta);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("No se pudo eliminar el adjunto de la entrega:", err.message);
    }
  }
}

// Responde un error descartando el archivo que multer ya haya escrito.
async function rechazarEntrega(req, res, status, mensaje) {
  if (req.file) await eliminarArchivoEntrega(req.file.filename);
  return res.status(status).json({ error: mensaje });
}

// Nombre original saneado para el encabezado Content-Disposition.
function nombreDescarga(entrega) {
  return path.basename(entrega.archivo_nombre || entrega.archivo_ruta || "entrega");
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const DT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

// Normaliza una fecha local ("2026-03-15T14:30" o "2026-03-15 14:30:00")
// al formato que acepta MySQL en la columna DATETIME.
function aDatetime(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !DT_RE.test(value)) return null;
  return String(value).replace("T", " ").slice(0, 19);
}

// Un admin todo lo puede. Un docente solo sobre sus propias asignaciones y un
// estudiante únicamente sobre las asignaciones donde está matriculado.
// (Se conserva el contrato externo grupo_id = id de la asignación.)
async function puedeVerGrupo(req, res, grupoId) {
  if (req.user.rol === "admin") {
    const [[a]] = await pool.query(
      "SELECT id FROM asignaciones WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    if (a) return true;
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  if (req.user.rol === "profesor") {
    const [[a]] = await pool.query(
      "SELECT id FROM asignaciones WHERE id = ? AND docente_id = ?",
      [grupoId, req.user.id],
    );
    if (a) return true;
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  if (req.user.rol === "estudiante") {
    const [[m]] = await pool.query(
      "SELECT id FROM matriculas WHERE estudiante_id = ? AND asignacion_id = ?",
      [req.user.id, grupoId],
    );
    if (m) return true;
    res.status(403).json({ error: "No autorizado" });
    return false;
  }
  res.status(403).json({ error: "Prohibido" });
  return false;
}

async function esProfesorDeGrupo(req, grupoId) {
  if (req.user.rol === "admin") {
    const [[a]] = await pool.query(
      "SELECT id FROM asignaciones WHERE id = ? AND institucion_id = ?",
      [grupoId, req.user.institucion_id],
    );
    return !!a;
  }
  const [[a]] = await pool.query(
    "SELECT id FROM asignaciones WHERE id = ? AND docente_id = ?",
    [grupoId, req.user.id],
  );
  return !!a;
}

// Tareas de una asignación con indicadores de entregas (docente/estudiante).
r.get(
  "/grupo/:grupo_id",
  asyncHandler(async (req, res) => {
    const grupoId = parseId(req.params.grupo_id);
    if (!grupoId) return res.status(400).json({ error: "ID inválido" });
    if (!(await puedeVerGrupo(req, res, grupoId))) return;
    const [rows] = await pool.query(
      `SELECT t.id, t.titulo, t.descripcion, t.fecha_entrega, t.puntaje_max, t.columna_nota,
            s.nombre AS materia, a.periodo,
            (SELECT COUNT(*) FROM matriculas mat WHERE mat.asignacion_id = t.asignacion_id) AS total_alumnos,
            (SELECT COUNT(*) FROM entregas_tareas e WHERE e.tarea_id = t.id) AS entregados
     FROM tareas t
     JOIN asignaciones a ON a.id = t.asignacion_id
     JOIN asignaturas s ON s.id = a.asignatura_id
     WHERE t.asignacion_id = ?
     ORDER BY t.fecha_entrega`,
      [grupoId],
    );
    res.json(rows);
  }),
);

// Tareas de todas las asignaturas de un estudiante (con su entrega, si existe).
r.get(
  "/estudiante",
  asyncHandler(async (req, res) => {
    if (req.user.rol !== "estudiante")
      return res.status(403).json({ error: "Prohibido" });
    const [rows] = await pool.query(
      `SELECT t.id AS tarea_id, t.titulo, t.descripcion, t.fecha_entrega, t.puntaje_max,
            s.nombre AS materia, s.codigo AS materia_codigo, a.periodo, a.id AS grupo_id,
            e.id AS entrega_id, e.archivo_url, e.fecha_entrega AS fecha_entrega_entrega,
            e.calificacion, e.comentario, e.retroalimentacion,
            e.archivo_nombre, e.archivo_mime, e.archivo_tamano, e.tardia,
            IF(e.archivo_ruta IS NOT NULL, 1, 0) AS archivo_subido
     FROM matriculas mat
     JOIN asignaciones a ON a.id = mat.asignacion_id
     JOIN asignaturas s ON s.id = a.asignatura_id
     JOIN tareas t ON t.asignacion_id = a.id
     LEFT JOIN entregas_tareas e ON e.tarea_id = t.id AND e.estudiante_id = mat.estudiante_id
     WHERE mat.estudiante_id = ?
     ORDER BY t.fecha_entrega`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

// Crea una tarea para una asignación (docente de la asignación o admin).
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const { grupo_id, titulo, descripcion, fecha_entrega, puntaje_max, columna_nota } =
      req.body;
    const grupoId = parseId(grupo_id);
    if (!grupoId || !titulo || typeof titulo !== "string" || !titulo.trim()) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (req.user.rol !== "profesor" && req.user.rol !== "admin") {
      return res.status(403).json({ error: "Prohibido" });
    }
    if (!(await esProfesorDeGrupo(req, grupoId))) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const columna = columna_nota ?? null;
    if (columna !== null && !COLUMNAS_NOTA.includes(columna)) {
      return res.status(400).json({ error: "Casillero de nota inválido" });
    }

    const puntaje =
      puntaje_max == null || puntaje_max === ""
        ? PUNTAJE_MAX_TAREA
        : Number(puntaje_max);
    if (!Number.isFinite(puntaje) || puntaje <= 0) {
      return res.status(400).json({ error: "Puntaje inválido" });
    }
    if (puntaje > PUNTAJE_MAX_TAREA) {
      return res
        .status(400)
        .json({ error: `El puntaje máximo no puede superar ${PUNTAJE_MAX_TAREA}` });
    }
    const fecha = aDatetime(fecha_entrega);
    if (fecha_entrega != null && fecha_entrega !== "" && !fecha) {
      return res.status(400).json({ error: "Fecha inválida" });
    }

    const [[grpRow]] = await pool.query("SELECT institucion_id FROM asignaciones WHERE id = ?", [grupoId]);
    const instId = grpRow?.institucion_id ?? req.user.institucion_id;

    const [result] = await pool.query(
      `INSERT INTO tareas (asignacion_id, titulo, descripcion, fecha_entrega, puntaje_max, columna_nota, institucion_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        grupoId,
        titulo.trim(),
        typeof descripcion === "string" ? descripcion.trim() || null : null,
        fecha,
        puntaje,
        columna,
        instId,
      ],
    );

    const [alumnos] = await pool.query(
      `SELECT mat.estudiante_id FROM matriculas mat WHERE mat.asignacion_id = ?`,
      [grupoId],
    );
    if (alumnos.length > 0) {
      for (const a of alumnos) {
        await notificar(
          a.estudiante_id,
          "Nueva tarea asignada",
          `Se publicó la tarea "${titulo.trim()}"${fecha ? ` para entregar el ${fecha.slice(0, 10)}` : ""}`,
          "tarea",
        );
      }
    }

    res.json({ ok: true, id: result.insertId });
  }),
);

// Entrega de un estudiante para una tarea de sus asignaturas (upsert).
// Acepta multipart/form-data con "archivo" o JSON con "archivo_url" (enlace
// externo). Al re-entregar se reemplaza el adjunto previo y se recalcula tardia.
r.post(
  "/:tarea_id/entregar",
  subirArchivoEntrega,
  asyncHandler(async (req, res) => {
    try {
      const tareaId = parseId(req.params.tarea_id);
      if (!tareaId) return await rechazarEntrega(req, res, 400, "ID inválido");
      if (req.user.rol !== "estudiante")
        return await rechazarEntrega(req, res, 403, "Prohibido");

      const archivo = req.file ?? null;
      const archivoUrl =
        typeof req.body.archivo_url === "string" ? req.body.archivo_url.trim() : "";
      const comentario =
        typeof req.body.comentario === "string" ? req.body.comentario.trim() || null : null;
      if (comentario && comentario.length > 255) {
        return await rechazarEntrega(
          req,
          res,
          400,
          "El comentario no puede superar los 255 caracteres",
        );
      }

      const [[t]] = await pool.query(
        `SELECT asignacion_id, fecha_entrega
         FROM tareas
         WHERE id = ? AND institucion_id = ?`,
        [tareaId, req.user.institucion_id],
      );
      if (!t) return await rechazarEntrega(req, res, 404, "Tarea no encontrada");

      const [[m]] = await pool.query(
        "SELECT id FROM matriculas WHERE estudiante_id = ? AND asignacion_id = ?",
        [req.user.id, t.asignacion_id],
      );
      if (!m) return await rechazarEntrega(req, res, 403, "No autorizado");

      const [[prev]] = await pool.query(
        "SELECT archivo_ruta, archivo_url FROM entregas_tareas WHERE tarea_id = ? AND estudiante_id = ?",
        [tareaId, req.user.id],
      );

      // Sin archivo nuevo, sin enlace y sin adjunto previo no hay entrega.
      if (!archivo && !archivoUrl && !prev?.archivo_ruta && !prev?.archivo_url) {
        return await rechazarEntrega(
          req,
          res,
          400,
          "Adjunta un archivo o un enlace para entregar",
        );
      }

      const tardia = esEntregaTardia(t.fecha_entrega) ? 1 : 0;
      const archivoPrevio = prev?.archivo_ruta ?? null;

      if (prev) {
        // Re-entrega: cada modo reemplaza al anterior; un comentario solo
        // conserva el adjunto o el enlace ya registrados.
        if (archivo) {
          await pool.query(
            `UPDATE entregas_tareas
             SET archivo_ruta = ?, archivo_nombre = ?, archivo_mime = ?, archivo_tamano = ?,
                 archivo_url = NULL, comentario = ?, tardia = ?, fecha_entrega = NOW()
             WHERE tarea_id = ? AND estudiante_id = ?`,
            [
              archivo.filename,
              nombreOriginalSeguro(archivo.originalname),
              archivo.mimetype,
              archivo.size,
              comentario,
              tardia,
              tareaId,
              req.user.id,
            ],
          );
          if (archivoPrevio) await eliminarArchivoEntrega(archivoPrevio);
        } else if (archivoUrl) {
          await pool.query(
            `UPDATE entregas_tareas
             SET archivo_url = ?, archivo_ruta = NULL, archivo_nombre = NULL,
                 archivo_mime = NULL, archivo_tamano = NULL,
                 comentario = ?, tardia = ?, fecha_entrega = NOW()
             WHERE tarea_id = ? AND estudiante_id = ?`,
            [archivoUrl, comentario, tardia, tareaId, req.user.id],
          );
          if (archivoPrevio) await eliminarArchivoEntrega(archivoPrevio);
        } else {
          await pool.query(
            `UPDATE entregas_tareas
             SET comentario = ?, tardia = ?, fecha_entrega = NOW()
             WHERE tarea_id = ? AND estudiante_id = ?`,
            [comentario, tardia, tareaId, req.user.id],
          );
        }
      } else {
        await pool.query(
          `INSERT INTO entregas_tareas
             (tarea_id, estudiante_id, archivo_url, comentario,
              archivo_ruta, archivo_nombre, archivo_mime, archivo_tamano, tardia)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tareaId,
            req.user.id,
            archivo ? null : archivoUrl || null,
            comentario,
            archivo ? archivo.filename : null,
            archivo ? nombreOriginalSeguro(archivo.originalname) : null,
            archivo ? archivo.mimetype : null,
            archivo ? archivo.size : null,
            tardia,
          ],
        );
      }

      res.json({ ok: true, tardia: !!tardia });
    } catch (err) {
      if (req.file) await eliminarArchivoEntrega(req.file.filename);
      throw err;
    }
  }),
);

// Descarga (o previsualiza) el adjunto de una entrega. Solo el estudiante
// dueño, el docente de la asignación y un admin de la institución.
r.get(
  "/entrega/:entrega_id/archivo",
  asyncHandler(async (req, res) => {
    const entregaId = parseId(req.params.entrega_id);
    if (!entregaId) return res.status(400).json({ error: "ID inválido" });

    const [[e]] = await pool.query(
      `SELECT e.estudiante_id, e.archivo_ruta, e.archivo_nombre, e.archivo_mime,
              t.asignacion_id
       FROM entregas_tareas e
       JOIN tareas t ON t.id = e.tarea_id
       WHERE e.id = ?`,
      [entregaId],
    );
    if (!e) return res.status(404).json({ error: "Entrega no encontrada" });
    if (!e.archivo_ruta) {
      return res.status(404).json({ error: "La entrega no tiene archivo adjunto" });
    }

    const esDueno = req.user.rol === "estudiante" && e.estudiante_id === req.user.id;
    const esDocente = ["profesor", "admin"].includes(req.user.rol)
      ? await esProfesorDeGrupo(req, e.asignacion_id)
      : false;
    if (!esDueno && !esDocente) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const ruta = rutaDiscoEntrega(e.archivo_ruta);
    if (!ruta) return res.status(404).json({ error: "Archivo no encontrado" });

    const descargar = String(req.query.descargar ?? "") === "1";
    const nombre = nombreDescarga(e);
    res.sendFile(
      ruta,
      {
        headers: {
          "Content-Type": e.archivo_mime || "application/octet-stream",
          "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        },
      },
      (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ error: "Archivo no encontrado" });
        }
      },
    );
  }),
);

// Entregas de una tarea + alumnos que aún no han entregado (revisión docente).
r.get(
  "/:tarea_id/entregas",
  asyncHandler(async (req, res) => {
    const tareaId = parseId(req.params.tarea_id);
    if (!tareaId) return res.status(400).json({ error: "ID inválido" });
    const [[t]] = await pool.query(
      "SELECT id, asignacion_id, titulo, puntaje_max, columna_nota FROM tareas WHERE id = ?",
      [tareaId],
    );
    if (!t) return res.status(404).json({ error: "Tarea no encontrada" });
    // Se expone como grupo_id por compatibilidad con el panel.
    t.grupo_id = t.asignacion_id;
    if (!(await esProfesorDeGrupo(req, t.asignacion_id))) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM matriculas WHERE asignacion_id = ?",
      [t.asignacion_id],
    );
    const [entregas] = await pool.query(
      `SELECT e.id AS entrega_id, e.estudiante_id, u.nombre_completo AS estudiante, u.correo,
            e.archivo_url, e.fecha_entrega, e.calificacion, e.comentario, e.retroalimentacion,
            e.archivo_nombre, e.archivo_mime, e.archivo_tamano, e.tardia,
            IF(e.archivo_ruta IS NOT NULL, 1, 0) AS archivo_subido
     FROM entregas_tareas e
     JOIN usuarios u ON u.id = e.estudiante_id
     WHERE e.tarea_id = ?
     ORDER BY u.nombre_completo`,
      [tareaId],
    );
    const [sinEntrega] = await pool.query(
      `SELECT u.id AS estudiante_id, u.nombre_completo AS estudiante, u.correo
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     WHERE mat.asignacion_id = ?
       AND mat.estudiante_id NOT IN (SELECT estudiante_id FROM entregas_tareas WHERE tarea_id = ?)
     ORDER BY u.nombre_completo`,
      [t.asignacion_id, tareaId],
    );
    res.json({
      tarea: t,
      total_alumnos: total,
      entregas,
      sin_entrega: sinEntrega,
    });
  }),
);

// Califica una entrega (calificación y retroalimentación).
r.post(
  "/calificar/:entrega_id",
  asyncHandler(async (req, res) => {
    const entregaId = parseId(req.params.entrega_id);
    if (!entregaId) return res.status(400).json({ error: "ID inválido" });
    const { calificacion, retroalimentacion } = req.body;
    const nota =
      calificacion === "" || calificacion == null ? null : Number(calificacion);
    if (nota !== null && !Number.isFinite(nota)) {
      return res.status(400).json({ error: "Calificación inválida" });
    }
    if (nota !== null && nota < 0) {
      return res
        .status(400)
        .json({ error: "La calificación no puede ser negativa" });
    }

    const [[e]] = await pool.query(
      `SELECT e.id, e.estudiante_id, e.tarea_id, t.puntaje_max, t.columna_nota, t.asignacion_id
     FROM entregas_tareas e
     JOIN tareas t ON t.id = e.tarea_id
     WHERE e.id = ?`,
      [entregaId],
    );
    if (!e) return res.status(404).json({ error: "Entrega no encontrada" });
    // Se expone como grupo_id por compatibilidad con la sincronización.
    e.grupo_id = e.asignacion_id;
    if (!(await esProfesorDeGrupo(req, e.asignacion_id))) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (nota !== null && nota > Number(e.puntaje_max)) {
      return res.status(400).json({ error: "Calificación fuera de rango" });
    }

    await pool.query(
      "UPDATE entregas_tareas SET calificacion = ?, retroalimentacion = ? WHERE id = ?",
      [nota, retroalimentacion ?? null, entregaId],
    );

    // Si la tarea está vinculada a un casillero de la planilla, sincroniza la
    // nota del estudiante (promedio de tareas del casillero).
    if (e.columna_nota) {
      await recalcularCasillero({
        estudianteId: e.estudiante_id,
        grupoId: e.grupo_id,
        columna: e.columna_nota,
      });
    }
    res.json({ ok: true });
  }),
);

export default r;
