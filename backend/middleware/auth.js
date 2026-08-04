import jwt from "jsonwebtoken";

/** Valida el JWT del header `Authorization: Bearer <token>` y adjunta `req.user`. */
export function verifyToken(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev");
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
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
