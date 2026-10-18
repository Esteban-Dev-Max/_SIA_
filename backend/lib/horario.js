// ---------------------------------------------------------------------------
// Utilidades de horario de asignaciones. El horario se guarda como texto libre
// (ej. "Lun y Mie 7:00 - 9:00"). Estas funciones lo interpretan de forma
// tolerante para detectar choques entre asignaciones; si no se puede
// interpretar, devuelven null/false y la validación se omite (no se bloquea
// la operación).
// ---------------------------------------------------------------------------

const DIAS = { lun: 1, mar: 2, mie: 3, mi: 3, jue: 4, vie: 5, sab: 6, dom: 7 };

const NOMBRES_DIAS = [
  ["lunes", 1],
  ["martes", 2],
  ["miércoles", 3],
  ["miercoles", 3],
  ["jueves", 4],
  ["viernes", 5],
  ["sábado", 6],
  ["domingo", 7],
];

function aMin(h, min) {
  return Number(h) * 60 + Number(min);
}

/** Devuelve { dias:Set<número>, rangos:[[inicio,fin],...] } o null si no es interpretable. */
export function normalizarHorario(texto) {
  if (!texto || typeof texto !== "string") return null;
  const t = texto.toLowerCase();
  const dias = new Set();
  for (const [token, num] of Object.entries(DIAS)) {
    if (t.includes(token)) dias.add(num);
  }
  for (const [nombre, num] of NOMBRES_DIAS) {
    if (new RegExp(`\\b${nombre}`, "i").test(t)) dias.add(num);
  }
  const rangos = [];
  const re = /(\d{1,2}):(\d{2})\s*(?:-|a|hasta)\s*(\d{1,2}):(\d{2})/gi;
  let m;
  while ((m = re.exec(t)) !== null) {
    const inicio = aMin(m[1], m[2]);
    const fin = aMin(m[3], m[4]);
    if (fin > inicio) rangos.push([inicio, fin]);
  }
  if (dias.size === 0 || rangos.length === 0) return null;
  return { dias, rangos };
}

/** true si dos textos de horario comparten día y se solapan en tiempo. */
export function hayChoqueHorarios(h1, h2) {
  const a = normalizarHorario(h1);
  const b = normalizarHorario(h2);
  if (!a || !b) return false;
  const compartenDia = [...a.dias].some((d) => b.dias.has(d));
  if (!compartenDia) return false;
  return a.rangos.some((ra) => b.rangos.some((rb) => ra[0] < rb[1] && rb[0] < ra[1]));
}