import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { detectarIntento, personalizar } from "../lib/chatbotEngine.js";

const r = Router();
r.use(verifyToken);

// Punto de entrada del asistente con respuestas por intención. La ruta de IA
// (`POST /api/chat`) reutiliza este motor como respaldo cuando la IA no está
// disponible o falla la llamada.
r.post(
  "/pregunta",
  asyncHandler(async (req, res) => {
    const pregunta = (req.body?.pregunta || "").toString().trim();
    if (!pregunta) return res.status(400).json({ error: "Faltan datos" });

    const intento = detectarIntento(pregunta);
    const resp = await personalizar(intento, req);

    res.json({
      pregunta,
      respuesta: resp.texto,
      opciones: resp.opciones || [],
      intento,
    });
  }),
);

export default r;
