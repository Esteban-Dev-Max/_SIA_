import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import XLSX from "xlsx";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
r.use(verifyToken, requireRole("admin", "superadmin"));

// Roles permitidos en la carga masiva (el resto se crea manualmente).
const ROLES_VALIDOS = new Set(["profesor", "estudiante", "acudiente"]);
const COLUMNAS = ["nombre", "correo", "rol", "password"];
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILAS = 2000;

// ---------- Subida del archivo (memoria, se procesa y descarta) ----------
const EXTENSIONES = [".csv", ".xlsx", ".xls"];
const uploadArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXTENSIONES.includes(ext)) return cb(null, true);
    const err = new Error("El archivo debe ser .csv o .xlsx");
    err.status = 400;
    cb(err);
  },
});

// Envuelve multer para traducir sus errores a respuestas 4xx en español.
function subirArchivo(req, res, next) {
  uploadArchivo.single("archivo")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ error: "El archivo supera el tamaño máximo permitido (5 MB)" });
      }
      return res.status(err.status ?? 400).json({
        error: err.message || "Error al procesar el archivo",
      });
    }
    next();
  });
}

/** Lanza un Error 400 con mensaje en español. */
function error400(mensaje) {
  const err = new Error(mensaje);
  err.status = 400;
  return err;
}

/** Lee un .csv o .xlsx y devuelve las filas como objetos { fila, nombre, correo, rol, password }. */
function parsearArchivo(buffer) {
  // Detecta binario por su firma ("PK" para .xlsx, "D0 CF 11 E0" para .xls);
  // lo demás se interpreta como CSV con codificación UTF-8 (respeta acentos).
  const esBinario =
    (buffer[0] === 0x50 && buffer[1] === 0x4b) ||
    (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0);

  let libro;
  try {
    libro = esBinario
      ? XLSX.read(buffer, { type: "buffer" })
      : XLSX.read(buffer.toString("utf8").replace(/^\uFEFF/, ""), { type: "string" });
  } catch {
    throw error400("No se pudo leer el archivo. Verifica que sea un .csv o .xlsx válido");
  }

  const primeraHoja = libro.SheetNames[0];
  if (!primeraHoja) {
    throw error400("El archivo no contiene hojas de cálculo");
  }

  const filas = XLSX.utils.sheet_to_json(libro.Sheets[primeraHoja], {
    header: 1,
    defval: "",
  });
  if (filas.length < 2) {
    throw error400("El archivo debe incluir un encabezado y al menos una fila de datos");
  }

  const encabezados = (filas[0] || []).map((h) =>
    String(h).trim().toLowerCase().replace(/^\uFEFF/, ""),
  );
  const faltantes = COLUMNAS.filter((col) => !encabezados.includes(col));
  if (faltantes.length > 0) {
    throw error400(`El archivo debe contener las columnas: ${COLUMNAS.join(", ")}`);
  }

  const idx = Object.fromEntries(COLUMNAS.map((col) => [col, encabezados.indexOf(col)]));
  const resultado = [];
  for (let i = 1; i < filas.length; i++) {
    const raw = filas[i];
    if (!raw || raw.every((v) => v === "" || v == null)) continue; // fila vacía
    resultado.push({
      fila: i + 1, // número de fila visible en la hoja (1 = encabezado)
      nombre: String(raw[idx.nombre] ?? ""),
      correo: String(raw[idx.correo] ?? ""),
      rol: String(raw[idx.rol] ?? ""),
      password: String(raw[idx.password] ?? ""),
    });
  }
  return resultado;
}

// ---------- Carga masiva de usuarios ----------
r.post(
  "/carga-masiva",
  subirArchivo,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo" });
    }
    const { institucion_id } = req.user;
    if (!institucion_id) {
      return res
        .status(400)
        .json({ error: "Tu cuenta no tiene una institución asociada para asignar a los nuevos usuarios" });
    }

    const filas = parsearArchivo(req.file.buffer);
    if (filas.length === 0) {
      return res.status(400).json({ error: "El archivo no contiene filas de datos" });
    }
    if (filas.length > MAX_FILAS) {
      return res
        .status(400)
        .json({ error: `El archivo supera el máximo de ${MAX_FILAS} filas por carga` });
    }

    // Correos que ya existen en la institución (una sola consulta para todo el archivo).
    const correosCandidatos = [
      ...new Set(filas.map((f) => f.correo.trim().toLowerCase()).filter(Boolean)),
    ];
    const correosEnBD = new Set();
    if (correosCandidatos.length > 0) {
      const [existentes] = await pool.query(
        "SELECT LOWER(correo) AS correo FROM usuarios WHERE LOWER(correo) IN (?)",
        [correosCandidatos],
      );
      for (const e of existentes) correosEnBD.add(e.correo);
    }

    // Validación por fila (estrategia de mejor esfuerzo).
    const validos = [];
    const fallidos = [];
    const correosEnArchivo = new Set();

    for (const fila of filas) {
      const nombre = fila.nombre.trim();
      const correo = fila.correo.trim().toLowerCase();
      const rol = fila.rol.trim().toLowerCase();
      const password = fila.password;

      let motivo = "";
      if (!nombre) motivo = "Falta el campo 'nombre'";
      else if (nombre.length > 150) motivo = "El nombre supera los 150 caracteres";
      else if (!correo) motivo = "Falta el campo 'correo'";
      else if (correo.length > 150) motivo = "El correo supera los 150 caracteres";
      else if (!RE_CORREO.test(correo)) motivo = `El correo no es válido: '${fila.correo.trim()}'`;
      else if (!ROLES_VALIDOS.has(rol)) {
        motivo = `Rol inválido: '${fila.rol.trim()}'. Usa Profesor, Estudiante o Acudiente`;
      } else if (!password) motivo = "Falta el campo 'password'";
      else if (String(password).length < 6) motivo = "La contraseña debe tener al menos 6 caracteres";
      else if (correosEnBD.has(correo)) motivo = "El correo ya está registrado";
      else if (correosEnArchivo.has(correo)) motivo = "Correo duplicado en el mismo archivo";

      if (motivo) {
        fallidos.push({ fila: fila.fila, correo, motivo });
      } else {
        correosEnArchivo.add(correo);
        validos.push({ fila: fila.fila, nombre, correo, rol, password: String(password) });
      }
    }

    // Inserta los válidos en una transacción; los que fallen a mitad se registran
    // (p. ej. por una carrera de correos) sin tumbar el resto.
    const exitosos = [];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const v of validos) {
        try {
          const hash = await bcrypt.hash(v.password, 10);
          const [result] = await conn.query(
            `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, institucion_id)
             VALUES (?, ?, ?, ?, ?)`,
            [v.nombre, v.correo, hash, v.rol, institucion_id],
          );
          if (v.rol === "estudiante") {
            await conn.query("UPDATE usuarios SET codigo_carnet = ? WHERE id = ?", [
              `EST-${String(result.insertId).padStart(5, "0")}`,
              result.insertId,
            ]);
          }
          exitosos.push({
            fila: v.fila,
            id: result.insertId,
            nombre: v.nombre,
            correo: v.correo,
            rol: v.rol,
          });
        } catch (e) {
          if (e.code === "ER_DUP_ENTRY") {
            fallidos.push({
              fila: v.fila,
              correo: v.correo,
              motivo: "El correo ya está registrado",
            });
          } else {
            throw e;
          }
        }
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    res.json({
      ok: true,
      total: filas.length,
      insertados: exitosos.length,
      fallidos: fallidos.length,
      exitosos,
      fallidos,
    });
  }),
);

export default r;