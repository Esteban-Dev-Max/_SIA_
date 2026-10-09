import { pool } from "../db.js";

// Umbrales compartidos por los endpoints de resumen/reportes. El frontend los
// duplica en src/lib/asistencia.ts: si cambias uno, cambia el otro.
export const UMBRAL_RIESGO = 80;
export const UMBRAL_ALERTA = 90;
export const UMBRAL_FALLAS_CRITICAS = 3;

export function fechaValida(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

// Construye la cláusula WHERE (sobre el LEFT JOIN de asistencia) a partir de un
// rango opcional de fechas. Devuelve { error } si el rango es inválido.
export function construirRango(desde, hasta) {
  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) {
    return { error: "Rango de fechas inválido" };
  }
  if (desde && hasta && String(desde) > String(hasta)) {
    return { error: "La fecha 'desde' no puede ser mayor que 'hasta'" };
  }
  let condicion = "";
  const params = [];
  if (desde && hasta) {
    condicion = " AND a.fecha BETWEEN ? AND ?";
    params.push(String(desde), String(hasta));
  } else if (desde) {
    condicion = " AND a.fecha >= ?";
    params.push(String(desde));
  } else if (hasta) {
    condicion = " AND a.fecha <= ?";
    params.push(String(hasta));
  }
  return { condicion, params, desde: desde ?? null, hasta: hasta ?? null };
}

function contadores(vacio) {
  return {
    estudiante_id: 0,
    matricula_id: 0,
    estudiante: "",
    correo: "",
    foto_url: null,
    presentes: 0,
    ausentes: 0,
    tardes: 0,
    excusas: 0,
    total: 0,
    fallas: 0,
    porcentaje: null,
    registros: [],
    en_riesgo: false,
    fallas_criticas: false,
    nivel: "sin_registros",
  };
}

// Semáforo de riesgo por estudiante (mismo criterio en el frontend):
//   critico       < 80% de asistencia o alcanzó el tope de fallas críticas
//   alerta        80% - 89%
//   bajo          >= 90%
//   sin_registros aún sin marcas en el rango consultado.
export function nivelRiesgo(e) {
  if (e.porcentaje === null) return "sin_registros";
  if (e.porcentaje < UMBRAL_RIESGO || e.fallas_criticas) return "critico";
  if (e.porcentaje < UMBRAL_ALERTA) return "alerta";
  return "bajo";
}

// Agrega los flags de riesgo sobre cada estudiante ya calculado. Se extrae para
// reutilizarlo en reportes y exportaciones con el mismo criterio.
export function marcarRiesgo(estudiantes) {
  for (const e of estudiantes) {
    e.en_riesgo = e.porcentaje != null && e.porcentaje < UMBRAL_RIESGO;
    e.fallas_criticas = e.fallas >= UMBRAL_FALLAS_CRITICAS;
    e.nivel = nivelRiesgo(e);
  }
  return estudiantes;
}

// Resumen histórico consolidado de asistencia por estudiante para un grupo.
// Semántica compartida con /resumen/estudiante: fallas = ausentes + tardes y
// porcentaje sobre registros con estado (excluye fechas sin marcar). Acepta un
// rango opcional { desde, hasta }. Devuelve { grupo, estudiantes, totales }.
export async function cargarResumenGrupo(grupoId, { desde = null, hasta = null } = {}) {
  const [[grupo]] = await pool.query(
    `SELECT g.id, g.codigo_grupo, g.periodo, g.horario,
            m.nombre AS materia, m.codigo AS materia_codigo,
            i.nombre AS institucion_nombre, i.logo_url AS institucion_logo
     FROM grupos g
     JOIN materias m ON m.id = g.materia_id
     JOIN instituciones i ON i.id = g.institucion_id
     WHERE g.id = ?`,
    [grupoId],
  );
  if (!grupo) return null;

  const rango = construirRango(desde, hasta);
  if (rango.error) return null;

  const [rows] = await pool.query(
    `SELECT u.id AS estudiante_id, mat.id AS matricula_id,
            u.nombre_completo AS estudiante,
            u.correo, u.foto_url, DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
            a.estado, a.observacion
     FROM matriculas mat
     JOIN usuarios u ON u.id = mat.estudiante_id
     LEFT JOIN asistencia a ON a.matricula_id = mat.id${rango.condicion}
     WHERE mat.grupo_id = ?
     ORDER BY u.nombre_completo, a.fecha DESC`,
    [...rango.params, grupoId],
  );

  // Última edición registrada por celda (matricula_id, fecha) en la audit log,
  // para exponer quién/cuándo/por qué se modificó cada marca.
  const [auditRows] = await pool.query(
    `SELECT au.matricula_id, DATE_FORMAT(au.fecha, '%Y-%m-%d') AS fecha,
            au.estado_anterior, au.estado_nuevo, au.justificacion,
            au.fecha_cambio, u.nombre_completo AS modificado_por
     FROM asistencia_audit au
     JOIN matriculas mat ON mat.id = au.matricula_id
     JOIN usuarios u ON u.id = au.usuario_id
     WHERE mat.grupo_id = ?${rango.condicion.replaceAll("a.fecha", "au.fecha")}`,
    [grupoId, ...rango.params],
  );
  const auditPorCelda = new Map();
  for (const a of auditRows) {
    auditPorCelda.set(`${a.matricula_id}|${a.fecha}`, {
      estado_anterior: a.estado_anterior,
      estado_nuevo: a.estado_nuevo,
      justificacion: a.justificacion,
      fecha_modificacion: a.fecha_cambio,
      modificado_por: a.modificado_por,
    });
  }

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.estudiante_id)) {
      const base = contadores();
      base.estudiante_id = row.estudiante_id;
      base.matricula_id = row.matricula_id;
      base.estudiante = row.estudiante;
      base.correo = row.correo;
      base.foto_url = row.foto_url;
      map.set(row.estudiante_id, base);
    }
    const e = map.get(row.estudiante_id);
    if (!row.estado) continue; // matrícula sin asistencia en el rango
    if (row.estado === "presente") e.presentes += 1;
    else if (row.estado === "ausente") e.ausentes += 1;
    else if (row.estado === "tarde") e.tardes += 1;
    else if (row.estado === "excusa") e.excusas += 1;
    const audit = auditPorCelda.get(`${row.matricula_id}|${row.fecha}`);
    e.registros.push({
      fecha: row.fecha,
      estado: row.estado,
      observacion: row.observacion,
      ...(audit
        ? {
            modificado_por: audit.modificado_por,
            fecha_modificacion: audit.fecha_modificacion,
            justificacion: audit.justificacion,
          }
        : {}),
    });
  }

  const estudiantes = [...map.values()].map((e) => {
    const registrados = e.presentes + e.ausentes + e.tardes + e.excusas;
    e.total = registrados;
    e.fallas = e.ausentes + e.tardes;
    e.porcentaje = registrados > 0 ? Math.round((e.presentes / registrados) * 100) : null;
    return e;
  });
  marcarRiesgo(estudiantes);

  const presentes = estudiantes.reduce((s, e) => s + e.presentes, 0);
  const registradosTotal = estudiantes.reduce((s, e) => s + e.total, 0);
  const totales = {
    presentes,
    ausentes: estudiantes.reduce((s, e) => s + e.ausentes, 0),
    tardes: estudiantes.reduce((s, e) => s + e.tardes, 0),
    excusas: estudiantes.reduce((s, e) => s + e.excusas, 0),
    total: registradosTotal,
    fallas: estudiantes.reduce((s, e) => s + e.fallas, 0),
    porcentaje_general: registradosTotal > 0 ? Math.round((presentes / registradosTotal) * 100) : null,
    en_riesgo: estudiantes.filter((e) => e.en_riesgo).length,
    fallas_criticas: estudiantes.filter((e) => e.fallas_criticas).length,
    niveles: {
      bajo: estudiantes.filter((e) => e.nivel === "bajo").length,
      alerta: estudiantes.filter((e) => e.nivel === "alerta").length,
      critico: estudiantes.filter((e) => e.nivel === "critico").length,
      sin_registros: estudiantes.filter((e) => e.nivel === "sin_registros").length,
    },
  };

  return { grupo, estudiantes, totales, desde: rango.desde, hasta: rango.hasta };
}