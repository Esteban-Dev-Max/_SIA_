import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { crearLimitePeticiones } from "../lib/rateLimit.js";
import { detectarIntento, personalizar } from "../lib/chatbotEngine.js";

const r = Router();
r.use(verifyToken);
r.use(crearLimitePeticiones());

const MAX_PREGUNTA = 500;
const TIMEOUT_MS = 30000;

// Recopila los datos académicos actuales del usuario para inyectarlos en el
// system prompt del modelo. El estudiante recibe su contexto completo; el
// acudiente/el profesor info ligada a sus vinculos, y el admin solo su nombre.
async function armarContexto(req) {
  const { rol, id } = req.user;
  const ctx = { rol };

  const [[u]] = await pool.query(
    "SELECT nombre_completo, correo FROM usuarios WHERE id = ?",
    [id],
  );
  if (u) ctx.nombre = u.nombre_completo;

  if (rol === "estudiante") {
    const [materias] = await pool.query(
      `SELECT m.nombre AS materia, n.nota_definitiva
       FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       JOIN materias m ON m.id = g.materia_id
       LEFT JOIN notas n ON n.matricula_id = mat.id
       WHERE mat.estudiante_id = ?
       ORDER BY m.nombre`,
      [id],
    );
    const conDef = materias.filter((x) => x.nota_definitiva != null);
    ctx.materiasNotas = materias;
    ctx.promedio =
      conDef.length > 0
        ? (
            conDef.reduce((s, x) => s + Number(x.nota_definitiva), 0) /
            conDef.length
          ).toFixed(2)
        : null;

    const [[asi]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END) AS presentes,
              SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) AS ausentes,
              SUM(CASE WHEN a.estado = 'tarde' THEN 1 ELSE 0 END) AS tardes,
              SUM(CASE WHEN a.estado = 'excusa' THEN 1 ELSE 0 END) AS excusas
       FROM matriculas mat
       LEFT JOIN asistencia a ON a.matricula_id = mat.id
       WHERE mat.estudiante_id = ?`,
      [id],
    );
    ctx.asistencia = {
      total: Number(asi?.total || 0),
      presentes: Number(asi?.presentes || 0),
      ausentes: Number(asi?.ausentes || 0),
      tardes: Number(asi?.tardes || 0),
      excusas: Number(asi?.excusas || 0),
    };

    const [tareas] = await pool.query(
      `SELECT t.titulo, t.fecha_entrega, m.nombre AS materia, e.id AS entregada
       FROM matriculas mat
       JOIN grupos g ON g.id = mat.grupo_id
       JOIN materias m ON m.id = g.materia_id
       JOIN tareas t ON t.grupo_id = g.id
       LEFT JOIN entregas_tareas e ON e.tarea_id = t.id AND e.estudiante_id = mat.estudiante_id
       WHERE mat.estudiante_id = ? AND t.fecha_entrega >= CURDATE() AND e.id IS NULL
       ORDER BY t.fecha_entrega ASC
       LIMIT 5`,
      [id],
    );
    ctx.proximas_entregas = tareas.map((t) => ({
      titulo: t.titulo,
      materia: t.materia,
      vence: t.fecha_entrega
        ? String(t.fecha_entrega).slice(0, 10)
        : "sin fecha",
    }));
  } else if (rol === "profesor") {
    const [grupos] = await pool.query(
      `SELECT g.codigo_grupo, m.nombre AS materia, g.periodo,
              (SELECT COUNT(*) FROM matriculas mat WHERE mat.grupo_id = g.id) AS alumnos
       FROM grupos g
       JOIN materias m ON m.id = g.materia_id
       WHERE g.profesor_id = ?
       ORDER BY m.nombre`,
      [id],
    );
    ctx.grupos = grupos;
  } else if (rol === "acudiente") {
    const [hijos] = await pool.query(
      `SELECT u.nombre_completo AS nombre FROM acudiente_estudiante ae
       JOIN usuarios u ON u.id = ae.estudiante_id
       WHERE ae.acudiente_id = ? AND u.estado = 'activo'
       ORDER BY u.nombre_completo`,
      [id],
    );
    ctx.hijos = hijos.map((h) => h.nombre);
  }

  return ctx;
}

function textoContexto(ctx) {
  const lineas = [];
  lineas.push(`Rol: ${ctx.rol}`);
  if (ctx.nombre) lineas.push(`Nombre: ${ctx.nombre}`);
  if (ctx.grupos) {
    lineas.push(
      "Grupos que dictas: " +
        (ctx.grupos.length
          ? ctx.grupos
              .map(
                (g) =>
                  `${g.materia} (ficha ${g.codigo_grupo}, ${g.alumnos} alumnos)`,
              )
              .join("; ")
          : "ninguno"),
    );
  }
  if (ctx.hijos) lineas.push(`Estudiantes a cargo: ${ctx.hijos.join(", ")}`);
  if (ctx.materiasNotas) {
    lineas.push("Materias con su definitiva:");
    for (const m of ctx.materiasNotas) {
      lineas.push(
        `- ${m.materia}: ${m.nota_definitiva != null ? Number(m.nota_definitiva).toFixed(2) : "sin definitiva"}`,
      );
    }
    if (ctx.promedio != null) lineas.push(`Promedio general: ${ctx.promedio}`);
  }
  if (ctx.asistencia) {
    const a = ctx.asistencia;
    lineas.push(
      `Asistencia registrada: ${a.total} registros (${a.presentes} presentes, ${a.ausentes} ausencias, ${a.tardes} llegadas tarde, ${a.excusas} excusas). Fallas acumuladas: ${a.ausentes + a.tardes}.`,
    );
  }
  if (ctx.proximas_entregas && ctx.proximas_entregas.length) {
    lineas.push("Próximas entregas de tareas:");
    for (const t of ctx.proximas_entregas)
      lineas.push(`- ${t.titulo} (${t.materia}), vence ${t.vence}`);
  } else if (ctx.proximas_entregas) {
    lineas.push("Próximas entregas de tareas: ninguna pendiente.");
  }
  return lineas.join("\n");
}

function construirSystemPrompt(ctx) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `Eres el Asistente SIA, un tutor virtual amable e inteligente. Puedes responder preguntas generales (matemáticas, ciencia, dudas de clase) y responder sobre los datos académicos específicos del alumno basándote en la información que se te proporciona.

Instrucciones:
- Responde SIEMPRE en español, de forma clara y breve (máximo 6 u 8 líneas).
- Si la pregunta pide datos del alumno que no están en el contexto, dilo con honestidad y sugiere dónde consultarlos (panel de estudiante o administración).
- Nunca inventes cifras, notas ni promedios.
- Fecha de hoy: ${hoy}. Usa ese formato (YYYY-MM-DD) para referencias temporales.

Contexto del alumno:
${textoContexto(ctx)}`;
}

// Llamada al modelo Gemini con el SDK oficial @google/generative-ai, timeout
// incluido para no colgar la petición. Cualquier error devuelve null para que
// el endpoint caiga al motor de reglas (nunca 500).
async function llamarGemini(systemPrompt, pregunta) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const genAI = new GoogleGenerativeAI(key);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
  });
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
  );
  try {
    const result = await Promise.race([
      genModel.generateContent(pregunta),
      timer,
    ]);
    const texto = result?.response?.text?.();
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch (err) {
    const estatus = err?.status ? ` (HTTP ${err.status})` : "";
    console.error(`Error al llamar a Gemini${estatus}: ${err.message}`);
    return null;
  }
}

// Conversación con el Asistente SIA: usa Gemini cuando hay API key y, si la
// llamada falla o no hay key, responde con el motor de reglas (nunca 500).
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const pregunta = (req.body?.pregunta || "").toString().trim();
    if (!pregunta) return res.status(400).json({ error: "Faltan datos" });
    if (pregunta.length > MAX_PREGUNTA) {
      return res.status(400).json({
        error: "La pregunta es demasiado larga (máx. 500 caracteres)",
      });
    }

    if (process.env.GEMINI_API_KEY) {
      const contexto = await armarContexto(req);
      const ai = await llamarGemini(construirSystemPrompt(contexto), pregunta);
      if (ai) {
        return res.json({
          pregunta,
          respuesta: ai,
          opciones: [],
          intento: "ia",
        });
      }
    }

    const intento = detectarIntento(pregunta);
    const resp = await personalizar(intento, req);
    res.json({
      pregunta,
      respuesta: resp.texto,
      opciones: resp.opciones || [],
      intento: "reglas",
    });
  }),
);

export default r;
