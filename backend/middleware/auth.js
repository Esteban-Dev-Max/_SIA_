import jwt from "jsonwebtoken";
import { pool } from "../db.js";

/** Valida el JWT del header `Authorization: Bearer <token>` y adjunta `req.user`.
 *
 * Además de validar la firma, verifica contra la base de datos que el usuario
 * siga existiendo, esté activo y tenga el mismo rol del token. Así, cuando un
 * administrador desactiva una cuenta o cambia su rol, la sesión anterior queda
 * invalidada de inmediato (no espera a que expire el JWT de 8 h). */
export async function verifyToken(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token)
      return res
        .status(401)
        .json({ error: "No autenticado. Inicia sesión de nuevo." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const [[u]] = await pool.query(
      `SELECT u.id, u.rol, u.estado, u.institucion_id, i.logo_url AS institucion_logo, i.estado AS institucion_estado, i.nombre AS institucion_nombre
       FROM usuarios u
       LEFT JOIN instituciones i ON i.id = u.institucion_id
       WHERE u.id = ?`,
      [payload.id],
    );
    if (!u) return res.status(401).json({ error: "Token inválido" });
    if (u.estado !== "activo") {
      return res
        .status(401)
        .json({ error: "Cuenta desactivada. Contacta con el administrador." });
    }
    if (u.rol !== payload.rol) {
      return res
        .status(401)
        .json({ error: "Tu rol cambió. Inicia sesión de nuevo." });
    }

    req.user = { ...payload, rol: u.rol, institucion_id: u.institucion_id, institucion_logo: u.institucion_logo, institucion_estado: u.institucion_estado, institucion_nombre: u.institucion_nombre };
    next();
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
    next(e);
  }
}

/** Restringe el acceso según el rol del usuario (RBAC). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "Prohibido" });
    }
    next();
  };
}
