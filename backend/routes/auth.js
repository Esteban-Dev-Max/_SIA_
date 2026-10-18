import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { verifyToken } from "../middleware/auth.js";
import {
  estaBloqueado,
  registrarFallo,
  limpiarBloqueo,
  crearLimitePeticiones,
} from "../lib/rateLimit.js";
import { mailer } from "../lib/mailer.js";

const r = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";

// Hash bcrypt (cost 10) de una clave ficticia: el login lo usa cuando el correo
// no existe para que todas las rutas hagan una comparación bcrypt y el tiempo no
// delate si una cuenta está registrada.
const HASH_DUMMY = "$2a$10$J3XifY/COjYnI9v.RVOLxOK5UgQDr89isuhrCohWfAo5v4/0SMvF2";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function correoRecuperacionHtml(nombre, enlace) {
  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const n = escape(nombre || "");
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Recuperación de contraseña</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.08)">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg,#4f46e5,#8b5cf6,#a855f7)"></td>
            </tr>
            <tr>
              <td style="padding:32px">
                <div style="font-size:24px;font-weight:700;color:#1e1b4b">SIA — Recuperación de contraseña</div>
                <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0 0">Hola, <strong>${n}</strong>:</p>
                <p style="color:#475569;font-size:15px;line-height:1.6;margin:8px 0 0">
                  Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de
                  abajo para crear una nueva. El enlace es válido por <strong>1 hora</strong>.
                </p>
                <p style="text-align:center;margin:28px 0">
                  <a href="${enlace}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px">
                    Restablecer mi contraseña
                  </a>
                </p>
                <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0">
                  Si no solicitaste este cambio, ignora este correo y tu contraseña seguirá igual.
                  Si el enlace no funciona, copia y pega esta dirección en tu navegador:
                </p>
                <p style="color:#4f46e5;font-size:13px;word-break:break-all;margin:8px 0 0">${enlace}</p>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
                <p style="color:#94a3b8;font-size:12px;margin:0">
                  Este es un mensaje automático de <strong>SIA</strong> — Sistema Integral Académico.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

r.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { correo, password } = req.body || {};
    if (
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !correo ||
      !password
    ) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const email = correo.trim().toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (estaBloqueado(email, ip)) {
      return res.status(429).json({
        error:
          "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
      });
    }

    const [rows] = await pool.query(
      `SELECT u.*, i.logo_url AS institucion_logo, i.estado AS institucion_estado, i.nombre AS institucion_nombre
       FROM usuarios u
       LEFT JOIN instituciones i ON i.id = u.institucion_id
       WHERE u.correo = ?`,
      [email],
    );
    const u = rows[0];
    const ok = u
      ? await bcrypt.compare(password, u.password)
      : await bcrypt.compare(password, HASH_DUMMY);
    if (!u || !ok) {
      registrarFallo(email, ip);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    // La contraseña es correcta: recién aquí se revela que la cuenta está
    // desactivada, para no exponer qué correos existen a quien no conoce la clave.
    if (u.estado !== "activo") {
      limpiarBloqueo(email, ip);
      return res
        .status(403)
        .json({ error: "Tu cuenta está desactivada. Contacta con el administrador." });
    }
    limpiarBloqueo(email, ip);

    const token = jwt.sign(
      {
        id: u.id,
        rol: u.rol,
        nombre: u.nombre_completo,
        correo: u.correo,
        foto_url: u.foto_url,
        institucion_id: u.institucion_id,
        institucion_logo: u.institucion_logo,
        institucion_estado: u.institucion_estado,
        institucion_nombre: u.institucion_nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );
    res.json({
      token,
      user: {
        id: u.id,
        nombre: u.nombre_completo,
        correo: u.correo,
        rol: u.rol,
        foto_url: u.foto_url,
        institucion_id: u.institucion_id,
        institucion_logo: u.institucion_logo,
        institucion_estado: u.institucion_estado,
        institucion_nombre: u.institucion_nombre,
      },
    });
  }),
);

r.get(
  "/me",
  verifyToken,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre_completo, u.correo, u.rol, u.foto_url, u.estado, i.logo_url AS institucion_logo, i.estado AS institucion_estado, i.nombre AS institucion_nombre
       FROM usuarios u
       LEFT JOIN instituciones i ON i.id = u.institucion_id
       WHERE u.id = ?`,
      [req.user.id],
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "No autorizado" });
    res.json({
      id: u.id,
      nombre: u.nombre_completo,
      correo: u.correo,
      rol: u.rol,
      foto_url: u.foto_url,
      institucion_logo: u.institucion_logo,
      institucion_estado: u.institucion_estado,
      institucion_nombre: u.institucion_nombre,
    });
  }),
);

r.post(
  "/cambiar-password",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { password_actual, password_nueva } = req.body || {};
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (String(password_nueva).length < 6) {
      return res
        .status(400)
        .json({
          error: "La nueva contraseña debe tener al menos 6 caracteres",
        });
    }

    const [[u]] = await pool.query(
      "SELECT id, `password` FROM usuarios WHERE id = ?",
      [req.user.id],
    );
    if (!u) return res.status(401).json({ error: "No autorizado" });

    const ok = await bcrypt.compare(password_actual, u.password);
    if (!ok)
      return res
        .status(400)
        .json({ error: "La contraseña actual no es correcta" });

    const repetida = await bcrypt.compare(password_nueva, u.password);
    if (repetida) {
      return res
        .status(400)
        .json({ error: "La nueva contraseña no puede ser igual a la actual" });
    }

    const hash = await bcrypt.hash(password_nueva, 10);
    await pool.query("UPDATE usuarios SET `password` = ? WHERE id = ?", [
      hash,
      u.id,
    ]);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Recuperación de contraseña (público, sin token). Respuesta genérica siempre
// para no revelar si un correo existe. Sin SMTP configurado, el enlace se
// imprime en consola para poder probar el flujo en desarrollo/local.
// ---------------------------------------------------------------------------
r.post(
  "/forgot-password",
  crearLimitePeticiones({ ventanaMs: 60 * 1000, maxPorVentana: 5 }),
  asyncHandler(async (req, res) => {
    const { correo } = req.body || {};
    if (typeof correo !== "string" || !correo.trim()) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const email = correo.trim().toLowerCase();

    const [rows] = await pool.query(
      "SELECT id, nombre_completo FROM usuarios WHERE correo = ? AND estado = 'activo'",
      [email],
    );
    const u = rows[0];

    if (u) {
      await pool.query("DELETE FROM password_resets WHERE usuario_id = ?", [u.id]);
      const token = crypto.randomBytes(32).toString("hex");
      await pool.query(
        `INSERT INTO password_resets (usuario_id, token_hash, expira_en)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
        [u.id, hashToken(token)],
      );
      const enlace = `${FRONTEND_URL}/reset-password?token=${token}`;
      try {
        const { enviado } = await mailer.enviar({
          para: email,
          asunto: "Recuperación de contraseña — SIA",
          html: correoRecuperacionHtml(u.nombre_completo, enlace),
        });
        if (!enviado) {
          console.log(`[SIA] Enlace de recuperación (sin SMTP): ${enlace}`);
        }
      } catch (err) {
        console.error("[SIA] Error enviando el correo de recuperación:", err);
        await pool.query("DELETE FROM password_resets WHERE usuario_id = ?", [u.id]);
      }
    }

    res.json({
      message:
        "Si el correo está registrado, recibirás las instrucciones en tu bandeja de entrada",
    });
  }),
);

r.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    if (
      typeof token !== "string" ||
      !token ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const [rows] = await pool.query(
      `SELECT pr.id AS pr_id, pr.usuario_id, u.estado
       FROM password_resets pr
       JOIN usuarios u ON u.id = pr.usuario_id
       WHERE pr.token_hash = ? AND pr.usado = 0 AND pr.expira_en > NOW()`,
      [hashToken(token)],
    );
    const pr = rows[0];
    if (!pr) {
      return res.status(400).json({
        error: "El enlace no es válido o ha expirado. Solicita uno nuevo.",
      });
    }
    if (pr.estado !== "activo") {
      return res
        .status(400)
        .json({ error: "La cuenta está desactivada. Contacta al administrador." });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE usuarios SET `password` = ? WHERE id = ?", [
      hash,
      pr.usuario_id,
    ]);
    await pool.query("UPDATE password_resets SET usado = 1 WHERE id = ?", [pr.pr_id]);
    await pool.query(
      "DELETE FROM password_resets WHERE usuario_id = ? AND id <> ?",
      [pr.usuario_id, pr.pr_id],
    );
    res.json({ ok: true });
  }),
);

export default r;
