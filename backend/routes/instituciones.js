import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { pool } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();

// Solo el superadmin puede gestionar instituciones
r.use(verifyToken, requireRole("superadmin"));

// Configuración multer para logos de instituciones
const MIME_LOGOS = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const CARPETA_LOGOS = path.join(process.cwd(), "uploads", "logos");
mkdirSync(CARPETA_LOGOS, { recursive: true });

const storageLogos = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, CARPETA_LOGOS);
  },
  filename(_req, file, cb) {
    cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const uploadLogo = multer({
  storage: storageLogos,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (MIME_LOGOS.includes(file.mimetype)) return cb(null, true);
    const err = new Error("Formato no permitido. Use PNG, JPG, SVG o WebP");
    err.status = 400;
    cb(err);
  },
});

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Elimina archivo físico del disco
async function eliminarArchivo(nombre) {
  if (!nombre || typeof nombre !== "string") return;
  const ruta = path.join(CARPETA_LOGOS, path.basename(nombre));
  try {
    await unlink(ruta);
  } catch (e) {
    if (e.code !== "ENOENT") console.error("No se pudo eliminar logo:", e.message);
  }
}

// Listar todas las instituciones (incluye logo_url)
r.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT id, nombre, correo, telefono, departamento, ciudad, estado, logo_url FROM instituciones ORDER BY nombre",
    );
    res.json(rows);
  }),
);

// Crear una institución + su administrador inicial (transacción atómica)
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      nombre,
      correo,
      telefono,
      departamento,
      ciudad,
      estado,
      admin_nombre,
      admin_email,
      admin_password,
      logo_url,
    } = req.body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre de la institución es obligatorio" });
    }

    // Validar campos del admin si se proporcionan
    const crearAdmin = !!(admin_email && admin_password && admin_nombre);
    if (crearAdmin) {
      if (!admin_nombre.trim() || !admin_email.trim() || !admin_password.trim()) {
        return res.status(400).json({ error: "Faltan datos del administrador (nombre, email, contraseña)" });
      }
      if (admin_password.length < 6) {
        return res.status(400).json({ error: "La contraseña del administrador debe tener al menos 6 caracteres" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
        return res.status(400).json({ error: "Correo del administrador inválido" });
      }
    }

    const est = estado === "inactivo" ? "inactivo" : "activo";

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) Insertar institución
      const [instResult] = await conn.query(
        "INSERT INTO instituciones (nombre, correo, telefono, departamento, ciudad, estado, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          nombre.trim(),
          correo?.trim() || null,
          telefono?.trim() || null,
          departamento?.trim() || null,
          ciudad?.trim() || null,
          est,
          logo_url?.trim() || null,
        ],
      );
      const institucionId = instResult.insertId;

      let adminId = null;

      // 2) Insertar administrador inicial (si se proporcionaron datos)
      if (crearAdmin) {
        const hash = await bcrypt.hash(admin_password, 10);
        const [adminResult] = await conn.query(
          `INSERT INTO usuarios (nombre_completo, correo, \`password\`, rol, estado, institucion_id)
           VALUES (?, ?, ?, 'admin', 'activo', ?)`,
          [admin_nombre.trim(), admin_email.trim().toLowerCase(), hash, institucionId],
        );
        adminId = adminResult.insertId;
      }

      await conn.commit();

      res.json({ ok: true, id: institucionId, admin_id: adminId });
    } catch (e) {
      await conn.rollback();
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "El correo del administrador ya está registrado" });
      }
      throw e;
    } finally {
      conn.release();
    }
  }),
);

// Subir logo de institución
r.post(
  "/:id/logo",
  uploadLogo.single("logo"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo" });

    // Verificar que la institución existe
    const [[inst]] = await pool.query("SELECT logo_url FROM instituciones WHERE id = ?", [id]);
    if (!inst) return res.status(404).json({ error: "Institución no encontrada" });

    // Eliminar logo anterior si existe
    if (inst.logo_url) {
      await eliminarArchivo(inst.logo_url);
    }

    // Guardar nueva ruta en BD
    const logoPath = `/api/uploads/logos/${req.file.filename}`;
    await pool.query("UPDATE instituciones SET logo_url = ? WHERE id = ?", [logoPath, id]);

    res.json({ ok: true, logo_url: logoPath });
  }),
);

// Eliminar logo de institución
r.delete(
  "/:id/logo",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const [[inst]] = await pool.query("SELECT logo_url FROM instituciones WHERE id = ?", [id]);
    if (!inst) return res.status(404).json({ error: "Institución no encontrada" });

    if (inst.logo_url) {
      await eliminarArchivo(inst.logo_url);
      await pool.query("UPDATE instituciones SET logo_url = NULL WHERE id = ?", [id]);
    }

    res.json({ ok: true });
  }),
);

// Editar una institución (incluye logo_url)
r.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const { nombre, correo, telefono, departamento, ciudad, estado, logo_url } = req.body;

    if (nombre !== undefined && (!nombre || typeof nombre !== "string" || !nombre.trim())) {
      return res.status(400).json({ error: "El nombre no puede estar vacío" });
    }

    if (estado !== undefined && !["activo", "inactivo"].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const sets = [];
    const params = [];

    if (nombre !== undefined) {
      sets.push("nombre = ?");
      params.push(nombre.trim());
    }
    if (correo !== undefined) {
      sets.push("correo = ?");
      params.push(correo.trim() || null);
    }
    if (telefono !== undefined) {
      sets.push("telefono = ?");
      params.push(telefono.trim() || null);
    }
    if (departamento !== undefined) {
      sets.push("departamento = ?");
      params.push(departamento.trim() || null);
    }
    if (ciudad !== undefined) {
      sets.push("ciudad = ?");
      params.push(ciudad.trim() || null);
    }
    if (estado !== undefined) {
      sets.push("estado = ?");
      params.push(estado);
    }
    if (logo_url !== undefined) {
      sets.push("logo_url = ?");
      params.push(logo_url?.trim() || null);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: "Nada que actualizar" });
    }

    params.push(id);
    const [result] = await pool.query(
      `UPDATE instituciones SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    res.json({ ok: true });
  }),
);

// Eliminar una institución
r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const [[inst]] = await pool.query("SELECT logo_url FROM instituciones WHERE id = ?", [id]);
    if (!inst) return res.status(404).json({ error: "Institución no encontrada" });

    if (inst.logo_url) {
      await eliminarArchivo(inst.logo_url);
    }

    const [result] = await pool.query("DELETE FROM instituciones WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    res.json({ ok: true });
  }),
);

export default r;