import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import XLSX from "xlsx";
import { UMBRAL_RIESGO, UMBRAL_FALLAS_CRITICAS } from "./asistencia.js";

const CARPETA_LOGOS = path.join(process.cwd(), "uploads", "logos");

const ESTADO = {
  OK: "OK",
  EN_RIESGO: `En riesgo (<${UMBRAL_RIESGO}%)`,
  CRITICO: `${UMBRAL_FALLAS_CRITICAS}+ fallas`,
};

export function estadoEstudiante(e) {
  if (e.porcentaje != null && e.porcentaje < UMBRAL_RIESGO) return ESTADO.EN_RIESGO;
  if (e.fallas >= UMBRAL_FALLAS_CRITICAS) return ESTADO.CRITICO;
  return ESTADO.OK;
}

function rangoTexto(desde, hasta) {
  return desde || hasta ? `${desde ?? "inicio"} a ${hasta ?? "hoy"}` : "Histórico completo";
}

function resumenFilas(resumen) {
  return resumen.estudiantes.map((e) => ({
    Estudiante: e.estudiante,
    Correo: e.correo,
    Presentes: e.presentes,
    Ausentes: e.ausentes,
    Tardes: e.tardes,
    Excusas: e.excusas,
    Total: e.total,
    Fallas: e.fallas,
    "% Asistencia": e.porcentaje == null ? "Sin registros" : `${e.porcentaje}%`,
    Estado: estadoEstudiante(e),
  }));
}

// Desglose de fallas: registros que no son "presente", con fecha y observación.
function detalleFallas(resumen) {
  const filas = [];
  for (const e of resumen.estudiantes) {
    for (const r of e.registros) {
      if (r.estado === "presente") continue;
      filas.push({
        Fecha: r.fecha,
        Estudiante: e.estudiante,
        Estado: r.estado.charAt(0).toUpperCase() + r.estado.slice(1),
        Observación: r.observacion ?? "",
      });
    }
  }
  return filas.sort((a, b) => a.Fecha.localeCompare(b.Fecha) || a.Estudiante.localeCompare(b.Estudiante));
}

function nombreArchivo(grupo, desde, hasta, extension) {
  const base = `asistencia_${grupo.codigo_grupo ?? grupo.id}`;
  if (desde || hasta) {
    return `${base}_${desde ?? "inicio"}_${hasta ?? "hoy"}.${extension}`;
  }
  return `${base}.${extension}`;
}

export function buildWorkbook(resumen) {
  const libro = XLSX.utils.book_new();
  const resumenWs = XLSX.utils.json_to_sheet(resumenFilas(resumen));
  resumenWs["!cols"] = [
    { wch: 30 },
    { wch: 28 },
    { wch: 10 },
    { wch: 10 },
    { wch: 9 },
    { wch: 9 },
    { wch: 8 },
    { wch: 8 },
    { wch: 14 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(libro, resumenWs, "Resumen");

  const detalleWs = XLSX.utils.json_to_sheet(detalleFallas(resumen));
  detalleWs["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(libro, detalleWs, "Detalle de fallas");

  return libro;
}

export function buildXlsxBuffer(resumen) {
  return XLSX.write(buildWorkbook(resumen), { type: "buffer", bookType: "xlsx" });
}

export function buildCsv(resumen) {
  const filas = resumenFilas(resumen);
  if (filas.length === 0) return "\uFEFFEstudiante,Correo,Presentes,Ausentes,Tardes,Excusas,Total,Fallas,% Asistencia,Estado\n";
  const hoja = XLSX.utils.json_to_sheet(filas);
  return "\uFEFF" + XLSX.utils.sheet_to_csv(hoja, { blankrows: false });
}

// Genera un PDF formateado con el membrete de la institución. Devuelve un Buffer.
export async function buildPdf(resumen) {
  const { grupo, estudiantes, totales } = resumen;
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const terminado = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const logo =
    grupo.institucion_logo && existsSync(path.join(CARPETA_LOGOS, path.basename(grupo.institucion_logo)))
      ? path.join(CARPETA_LOGOS, path.basename(grupo.institucion_logo))
      : null;

  const morado = "#4f46e5";
  const gris = "#64748b";
  const rojo = "#e11d48";
  const ambar = "#d97706";
  const verde = "#059669";

  function dibujarMembrete() {
    if (logo) {
      doc.image(logo, doc.page.margins.left, 36, { width: 56 });
      doc.fillColor(gris).fontSize(9).text(
        grupo.institucion_nombre,
        doc.page.margins.left + 66,
        40,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 66 },
      );
    } else {
      doc.fillColor(gris).fontSize(11).text(grupo.institucion_nombre, 48, 44);
    }
    doc.fillColor(morado).fontSize(20).font("Helvetica-Bold").text(
      `${grupo.materia} - ${grupo.codigo_grupo}`,
      48,
      logo ? 72 : 68,
    );
    doc.fillColor(gris).fontSize(10).font("Helvetica");
    doc.text(`Periodo: ${grupo.periodo ?? "-"}    Horario: ${grupo.horario ?? "-"}`, 48, logo ? 94 : 86);
    doc.moveDown(1);
  }

  function dibujarTabla() {
    const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const cols = [
      { k: "Estudiante", w: ancho * 0.42 },
      { k: "Asist.", w: ancho * 0.12 },
      { k: "Fallas", w: ancho * 0.1 },
      { k: "Estado", w: ancho * 0.22 },
      { k: "", w: ancho * 0.14 },
    ];
    const fila = (y, celdas) => {
      let x = doc.page.margins.left;
      for (let i = 0; i < cols.length; i += 1) {
        doc.text(celdas[i], x, y, { width: cols[i].w, height: 16, ellipsis: true });
        x += cols[i].w;
      }
    };
    const altoEncabezado = 18;
    let y = doc.y + 6;

    if (y + altoEncabezado > doc.page.height - doc.page.margins.bottom) doc.addPage();

    doc.rect(doc.page.margins.left, y, ancho, altoEncabezado).fill("#eef2ff");
    doc.fillColor("#3730a3").font("Helvetica-Bold").fontSize(9);
    for (let i = 0; i < cols.length; i += 1) {
      doc.text(cols[i].k || " ", doc.page.margins.left + (i === 0 ? 8 : 0), y + 5, {
        width: cols[i].w,
        height: 12,
      });
    }
    y += altoEncabezado;

    for (const e of estudiantes) {
      if (y + 18 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const estado = estadoEstudiante(e);
      const color = estado === ESTADO.CRITICO ? rojo : estado === ESTADO.EN_RIESGO ? ambar : "#1e293b";
      doc.fillColor("#1e293b").font("Helvetica").fontSize(9);
      fila(y, [
        e.estudiante,
        e.porcentaje == null ? "-" : `${e.porcentaje}%`,
        String(e.fallas),
        estado,
        "",
      ]);
      // Subrayado de color en la celda de estado para resaltar el riesgo.
      doc.fillColor(color === "#1e293b" ? verde : color).rect(
        doc.page.margins.left + cols[0].w + cols[1].w + cols[2].w + 4,
        y + 14,
        cols[3].w - 8,
        1.5,
      );
      y += 18;
    }
  }

  function dibujarDesglose() {
    doc.addPage();
    dibujarMembreteTitulo("Desglose de fallas");
    const registros = detalleFallas(resumen);
    if (registros.length === 0) {
      doc.fillColor(gris).fontSize(10).text("No hay fallas registradas en el rango seleccionado.");
      return;
    }
    let y = doc.y + 4;
    const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    for (const reg of registros) {
      if (y + 34 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const estadoColor = reg.Estado === "Ausente" ? rojo : reg.Estado === "Tarde" ? ambar : "#0284c7";
      doc.fillColor(morado).font("Helvetica-Bold").fontSize(9).text(reg.Fecha, doc.page.margins.left, y);
      doc.fillColor("#1e293b").font("Helvetica").fontSize(9).text(`${reg.Estudiante}  -  ${reg.Estado}`, doc.page.margins.left + 90, y);
      doc.fillColor(estadoColor).fontSize(9).text(reg.Estado, doc.page.margins.left + 220, y);
      if (reg["Observación"]) {
        doc.fillColor(gris).fontSize(8).text(reg["Observación"], doc.page.margins.left + 250, y + 1, { width: ancho - 250 });
      }
      doc.moveTo(doc.page.margins.left, y + 16).lineTo(doc.page.margins.left + ancho, y + 16).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      y += 20;
    }
  }

  function dibujarMembreteTitulo(titulo) {
    if (logo) {
      doc.image(logo, doc.page.margins.left, 40, { width: 44 });
    }
    doc.fillColor(morado).fontSize(16).font("Helvetica-Bold").text(titulo, 48, logo ? 52 : 48);
    doc.fillColor(gris).fontSize(10).font("Helvetica").text(
      `${grupo.institucion_nombre} - ${grupo.materia} (${grupo.codigo_grupo})`,
      48,
      logo ? 70 : 64,
    );
    doc.y = 88;
  }

  dibujarMembrete();

  doc.moveDown(0.2);
  doc.fillColor(gris).fontSize(10).font("Helvetica");
  doc.text(`Rango: ${rangoTexto(resumen.desde, resumen.hasta)}    Generado: ${new Date().toISOString().slice(0, 10)}`);
  doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(12).text(
    `Asistencia general de la clase: ${totales.porcentaje_general == null ? "sin registros" : `${totales.porcentaje_general}%`}`,
  );
  doc.fillColor(gris).font("Helvetica").fontSize(10).text(
    `Estudiantes: ${estudiantes.length}   En riesgo: ${totales.en_riesgo}   Fallas críticas: ${totales.fallas_criticas}`,
  );
  doc.moveDown(0.4);

  dibujarTabla();
  dibujarDesglose();

  doc.end();
  return terminado;
}

export { nombreArchivo };