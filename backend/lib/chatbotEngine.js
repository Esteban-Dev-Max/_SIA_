import { pool } from "../db.js";

// ---------------------------------------------------------------------------
// Motor de respuestas por intención (palabras clave).
// Se usa como respaldo del Asistente SIA cuando la IA (Gemini) no está
// configurada o falla la llamada. `personalizar()` consulta la BD según el
// rol del usuario y devuelve { texto, opciones }.
// ---------------------------------------------------------------------------

const FAQ_SUGERIDAS = [
  "¿Cómo veo mis notas?",
  "¿Cuándo debo entregar mi tarea?",
  "¿Cómo está mi promedio?",
  "¿Cómo reviso mi asistencia?",
  "¿Cómo me uno a una reunión?",
];

function norm(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const contiene = (texto, ...palabras) =>
  palabras.some((p) => texto.includes(p));

// Detección de intención por palabras clave (tolera tildes).
function detectarIntento(pregunta) {
  const t = norm(pregunta);
  if (
    contiene(
      t,
      "hola",
      "buenas",
      "buenos dias",
      "saludos",
      "hey",
      "que tal",
      "ayuda",
      "empezar",
    )
  )
    return "saludo";
  if (
    contiene(
      t,
      "nota",
      "notas",
      "calificacion",
      "calificaciones",
      "definitiva",
      "ver mis notas",
      "puntaje",
    )
  )
    return "notas";
  if (
    contiene(
      t,
      "tarea",
      "tareas",
      "entregar",
      "entrega",
      "vencer",
      "vencimiento",
      "plazo",
      "cuando debo",
    )
  )
    return "tareas";
  if (contiene(t, "promedio", "promedio general")) return "promedio";
  if (
    contiene(
      t,
      "asistencia",
      "falla",
      "fallas",
      "inasistencia",
      "faltas",
      "presente",
      "ausente",
    )
  )
    return "asistencia";
  if (contiene(t, "reunion", "reuniones", "unirme", "unir", "junta"))
    return "reunion";
  if (
    contiene(
      t,
      "matricula",
      "matriculas",
      "matricular",
      "inscribirme",
      "inscripcion",
    )
  )
    return "matricula";
  if (
    contiene(
      t,
      "materia",
      "materias",
      "horario",
      "grupo",
      "grupos",
      "curso",
      "clase",
    )
  )
    return "materias";
  if (contiene(t, "profesor", "profesores", "docente")) return "profesores";
  if (
    contiene(
      t,
      "contrasena",
      "contraseña",
      "password",
      "clave",
      "login",
      "ingresar",
      "entrar",
    )
  )
    return "acceso";
  if (contiene(t, "mensaje", "mensajes", "chat", "contactar", "escribir"))
    return "mensajes";
  if (
    contiene(t, "calendario", "evento", "eventos", "actividad", "actividades")
  )
    return "calendario";
  if (contiene(t, "boletin", "boletines", "reporte", "reportes", "certificado"))
    return "boletin";
  if (contiene(t, "notificacion", "notificaciones", "alerta", "alertas"))
    return "notificaciones";
  if (contiene(t, "examen", "parcial", "evaluacion", "evaluaciones", "quiz"))
    return "examenes";
  if (contiene(t, "gracias", "chao", "adios", "bye")) return "despedida";
  return "default";
}

function guiasBasicas() {
  return {
    notas:
      "Para ver tus notas: ingresa al panel, ve a la sección 'Mis calificaciones' y verás nota 1, nota 2, nota 3 y examen por materia. La definitiva se calcula como 25% + 25% + 20% + 30% del examen. Se aprueba con 3.0 o más.",
    tareas:
      "Las tareas las publica tu profesor por materia. En 'Mis tareas' ves el título, la fecha de entrega y el estado. Para entregar: abre la tarea, pega el enlace de tu archivo y envía tu comentario antes del vencimiento.",
    asistencia:
      "Tu asistencia se registra por materia y por fecha. En 'Mi asistencia' ves el porcentaje total, las fallas acumuladas y el detalle por materia. Se consideran estados: presente, ausente, tarde y excusa.",
    promedio:
      "Tu promedio general es el promedio de todas las definitivas de tus materias. Puedes verlo en la tarjeta 'Promedio general' del panel de estudiante.",
    reunion:
      "Las reuniones (reuniones de padres, comités, tutorías) se publican en el Calendario con su fecha y hora. Para unirte, abre el evento de tipo 'reunión' y sigue el enlace o la indicación del profesor. Si es virtual, revisa tu correo institucional para el enlace de la videollamada.",
    matricula:
      "La matrícula la gestiona el administrador. Si necesitas inscribirte a una materia o cambiar de grupo, contacta con administración desde el módulo de Mensajes.",
    materias:
      "Tus materias dependen de los grupos en los que estás matriculado. Cada grupo tiene un horario y un profesor asignado. Puedes verlo en el detalle de cada materia de tu panel.",
    profesores:
      "Puedes contactar a tus profesores desde el módulo de Mensajes, seleccionando el contacto y escribiendo tu consulta. También puedes hablarles en tutorías.",
    acceso:
      "Ingresa con tu correo institucional y contraseña en la pantalla de inicio. Si olvidaste tu contraseña, contacta al administrador para restablecerla.",
    mensajes:
      "El módulo de Mensajes te permite chatear con profesores, acudientes y administradores. En la columna izquierda ves tus conversaciones; selecciona un contacto para leer y responder.",
    calendario:
      "En el Calendario ves las tareas con su fecha de entrega y los eventos académicos (evaluaciones, reuniones, actividades). Usa la vista mensual o semanal para explorar.",
    boletin:
      "El boletín con tus notas definitivas por periodo lo emite el sistema. Puedes imprimirlo desde la vista de tu acudiente si estás vinculado a uno.",
    notificaciones:
      "La campana en la cabecera muestra tus alertas recientes: nuevas calificaciones, tareas por vencer y mensajes. Haz clic en una notificación para marcarla como leída.",
    examenes:
      "Los exámenes y parciales aparecen en el Calendario con su fecha y hora. Cada evaluación aporta un porcentaje de tu definitiva. Prepara bien los cortes 1, 2 y 3.",
    default:
      "No estoy seguro de haber entendido tu pregunta. Puedo ayudarte con: ver tus notas, próximas tareas, promedio, asistencia, reuniones, mensajes o el calendario académico. Intenta reformular tu pregunta.",
  };
}

// Respuestas dinámicas según el rol del usuario.
async function personalizar(intento, req) {
  const { rol, id } = req.user;

  if (intento === "saludo") {
    return {
      texto: `¡Hola! Soy el Asistente SIA, tu guía del ${rol === "admin" ? "administrador" : rol}. Puedo ayudarte a usar la plataforma: notas, tareas, asistencia, reuniones, mensajes y calendario. ¿En qué te ayudo hoy?`,
      opciones: FAQ_SUGERIDAS,
    };
  }

  if (intento === "despedida") {
    return {
      texto:
        "¡Fue un gusto ayudarte! Si necesitas algo más, aquí estaré. ¡Cuídate!",
      opciones: FAQ_SUGERIDAS.slice(0, 3),
    };
  }

  if (intento === "notas" || intento === "promedio" || intento === "boletin") {
    if (rol === "estudiante") {
      const [rows] = await pool.query(
        `SELECT m.nombre AS materia, n.nota_1, n.nota_2, n.nota_3, n.examen_final, n.nota_definitiva
         FROM matriculas mat
         JOIN grupos g ON g.id = mat.grupo_id
         JOIN materias m ON m.id = g.materia_id
         LEFT JOIN notas n ON n.matricula_id = mat.id
         WHERE mat.estudiante_id = ?
         ORDER BY m.nombre`,
        [id],
      );
      const conDef = rows.filter((x) => x.nota_definitiva != null);
      const promedio = conDef.length
        ? (
            conDef.reduce((s, x) => s + Number(x.nota_definitiva), 0) /
            conDef.length
          ).toFixed(2)
        : null;
      if (rows.length === 0) {
        return {
          texto:
            "Aún no tienes materias matriculadas. Contacta al administrador para gestionar tu matrícula.",
          opciones: ["¿Cómo me matricular?", "¿Cómo reviso mi asistencia?"],
        };
      }
      const resumen = rows
        .map(
          (x) =>
            `${x.materia}: ${x.nota_definitiva != null ? Number(x.nota_definitiva).toFixed(2) : "sin definitiva"}`,
        )
        .join("\n");
      const textoBase =
        intento === "promedio"
          ? `Tu promedio general es ${promedio ?? "aún no disponible"}.`
          : intento === "boletin"
            ? "Tu boletín con las definitivas de este periodo:"
            : "Tus notas por materia:";
      return {
        texto: `${textoBase}\n${resumen}${promedio && intento !== "promedio" ? `\nPromedio general: ${promedio}` : ""}`,
        opciones: [
          "¿Cómo se calcula la definitiva?",
          "¿Cuándo debo entregar mi tarea?",
        ],
      };
    }
    return {
      texto: guiasBasicas().notas,
      opciones: ["¿Cómo se calcula la definitiva?", "¿Cómo veo el boletín?"],
    };
  }

  if (intento === "tareas") {
    if (rol === "estudiante") {
      const [rows] = await pool.query(
        `SELECT t.titulo, t.fecha_entrega, m.nombre AS materia, e.id AS entregada
         FROM matriculas mat
         JOIN grupos g ON g.id = mat.grupo_id
         JOIN materias m ON m.id = g.materia_id
         JOIN tareas t ON t.grupo_id = g.id
         LEFT JOIN entregas_tareas e ON e.tarea_id = t.id AND e.estudiante_id = mat.estudiante_id
         WHERE mat.estudiante_id = ? AND (t.fecha_entrega IS NULL OR t.fecha_entrega >= CURDATE())
         ORDER BY t.fecha_entrega`,
        [id],
      );
      if (rows.length === 0) {
        return {
          texto: "No tienes tareas pendientes por entregar. ¡Buen trabajo!",
          opciones: ["¿Cómo veo mis notas?", "¿Cómo me uno a una reunión?"],
        };
      }
      const lista = rows
        .map(
          (x) =>
            `${x.titulo} (${x.materia})${x.fecha_entrega ? ` — vence ${String(x.fecha_entrega).slice(0, 10)}` : ""}${x.entregada ? " — ya entregada" : " — pendiente"}`,
        )
        .join("\n");
      return {
        texto: `Estas son tus tareas próximas:\n${lista}\nRecuerda entregarlas desde 'Mis tareas' antes del vencimiento.`,
        opciones: ["¿Cómo entrego una tarea?", "¿Cómo reviso mi asistencia?"],
      };
    }
    if (rol === "profesor") {
      return {
        texto:
          "Puedes crear tareas por grupo y revisar las entregas de cada alumno desde la sección 'Tareas'. Al crear una, los estudiantes reciben una notificación automática.",
        opciones: ["¿Cómo califico una entrega?", "¿Cómo registro notas?"],
      };
    }
    return {
      texto: guiasBasicas().tareas,
      opciones: ["¿Cómo veo el calendario?", "¿Cómo reviso mi asistencia?"],
    };
  }

  if (intento === "asistencia") {
    if (rol === "estudiante") {
      const [[res]] = await pool.query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END) AS presentes,
                SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) AS ausentes
         FROM matriculas mat
         LEFT JOIN asistencia a ON a.matricula_id = mat.id
         WHERE mat.estudiante_id = ?`,
        [id],
      );
      const total = Number(res?.total || 0);
      const presentes = Number(res?.presentes || 0);
      const ausentes = Number(res?.ausentes || 0);
      const pct = total ? Math.round((presentes / total) * 100) : null;
      return {
        texto:
          total === 0
            ? "Aún no hay registros de asistencia para ti."
            : `Tienes ${presentes} presencias y ${ausentes} ausencias sobre ${total} registros. Tu porcentaje de asistencia es ${pct}%.`,
        opciones: ["¿Cuántas fallas tengo?", "¿Cómo veo mis notas?"],
      };
    }
    return {
      texto: guiasBasicas().asistencia,
      opciones: ["¿Cómo veo el calendario?", "¿Cómo me uno a una reunión?"],
    };
  }

  if (intento === "reunion") {
    const [eventos] = await pool.query(
      `SELECT titulo, fecha_inicio, fecha_fin FROM eventos_calendario
       WHERE tipo = 'reunion' AND fecha_inicio >= NOW()
       ORDER BY fecha_inicio LIMIT 5`,
    );
    if (eventos.length > 0) {
      const lista = eventos
        .map(
          (e) =>
            `${e.titulo} — ${String(e.fecha_inicio).slice(0, 16).replace("T", " ")}`,
        )
        .join("\n");
      return {
        texto: `Próximas reuniones en el calendario:\n${lista}\nAbre el evento para ver el enlace o las instrucciones.`,
        opciones: ["¿Cómo veo el calendario?", "¿Cómo reviso mis notas?"],
      };
    }
    return {
      texto: guiasBasicas().reunion,
      opciones: ["¿Cómo veo el calendario?", "¿Cómo contacto a mi profesor?"],
    };
  }

  if (intento === "examenes") {
    const [eventos] = await pool.query(
      `SELECT titulo, fecha_inicio FROM eventos_calendario
       WHERE tipo = 'evaluacion' AND fecha_inicio >= NOW()
       ORDER BY fecha_inicio LIMIT 5`,
    );
    if (eventos.length > 0) {
      const lista = eventos
        .map(
          (e) =>
            `${e.titulo} — ${String(e.fecha_inicio).slice(0, 16).replace("T", " ")}`,
        )
        .join("\n");
      return {
        texto: `Próximas evaluaciones:\n${lista}`,
        opciones: ["¿Cómo se calcula mi definitiva?", "¿Cómo repaso?"],
      };
    }
    return {
      texto: guiasBasicas().examenes,
      opciones: ["¿Cómo veo el calendario?", "¿Cómo reviso mis notas?"],
    };
  }

  if (intento === "calendario") {
    const [[n]] = await pool.query(
      "SELECT COUNT(*) AS n FROM eventos_calendario WHERE fecha_inicio >= NOW()",
    );
    return {
      texto: `En el Calendario encuentras tus tareas y los eventos académicos. Hay ${n} eventos programados. Usa las vistas mensual o semanal y los colores por tipo de evento.`,
      opciones: [
        "¿Cuándo debo entregar mi tarea?",
        "¿Cómo me uno a una reunión?",
      ],
    };
  }

  if (intento === "mensajes") {
    if (rol === "estudiante") {
      const [[n]] = await pool.query(
        "SELECT COUNT(*) AS n FROM mensajes WHERE destinatario_id = ? AND leido = 0",
        [id],
      );
      return {
        texto: `Tienes ${n} mensaje(s) sin leer. Abre el módulo de Mensajes para ver tus conversaciones y responder a profesores, acudientes o administradores.`,
        opciones: ["¿Cómo contacto a mi profesor?", "¿Cómo reviso mis notas?"],
      };
    }
    return {
      texto: guiasBasicas().mensajes,
      opciones: [
        "¿Cómo reviso mis notificaciones?",
        "¿Cómo veo el calendario?",
      ],
    };
  }

  if (intento === "notificaciones") {
    const [[n]] = await pool.query(
      "SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida = 0",
      [id],
    );
    return {
      texto: `Tienes ${n} notificación(es) sin leer. Ábrelas desde la campana de la cabecera; al hacer clic se marcan como leídas.`,
      opciones: ["¿Qué tipo de alertas recibo?", "¿Cómo reviso mis mensajes?"],
    };
  }

  return {
    texto: guiasBasicas()[intento] || guiasBasicas().default,
    opciones: FAQ_SUGERIDAS,
  };
}

export {
  FAQ_SUGERIDAS,
  norm,
  contiene,
  detectarIntento,
  guiasBasicas,
  personalizar,
};
