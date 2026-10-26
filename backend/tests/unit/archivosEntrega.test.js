import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXTENSIONES_ENTREGA,
  TAMANO_MAX_ENTREGA,
  esEntregaTardia,
  extensionArchivo,
  extensionPermitida,
  nombreOriginalSeguro,
} from "../../lib/archivosEntrega.js";

test("extensionArchivo normaliza mayúsculas, punto y rutas", () => {
  assert.equal(extensionArchivo("Tarea.PDF"), "pdf");
  assert.equal(extensionArchivo("C:\\docs\\tarea.docx"), "docx");
  assert.equal(extensionArchivo("archivo.zip"), "zip");
  assert.equal(extensionArchivo("sin_extension"), "");
  assert.equal(extensionArchivo(null), "");
});

test("extensionPermitida acepta los formatos de tareas y rechaza ejecutables", () => {
  for (const ext of EXTENSIONES_ENTREGA) {
    assert.equal(extensionPermitida(`entrega.${ext}`), true, ext);
    assert.equal(extensionPermitida(`ENTREGA.${ext.toUpperCase()}`), true, ext);
  }
  for (const nombre of ["virus.exe", "script.js", "archivo.html", "sin_extension"]) {
    assert.equal(extensionPermitida(nombre), false, nombre);
  }
});

test("esEntregaTardia compara contra la fecha límite", () => {
  const ahora = new Date("2026-05-10T12:00:00");
  assert.equal(esEntregaTardia(null, ahora), false);
  assert.equal(esEntregaTardia(new Date("2026-05-10T11:59:00"), ahora), true);
  assert.equal(esEntregaTardia("2026-05-10T12:01:00", ahora), false);
  assert.equal(esEntregaTardia("fecha inválida", ahora), false);
});

test("el límite de tamaño es de 10 MB", () => {
  assert.equal(TAMANO_MAX_ENTREGA, 10 * 1024 * 1024);
});

test("nombreOriginalSeguro quita rutas y recorta conservando la extensión", () => {
  assert.equal(nombreOriginalSeguro("C:\\docs\\tarea.pdf"), "tarea.pdf");
  assert.equal(nombreOriginalSeguro("  ensayo.docx  "), "ensayo.docx");
  assert.equal(nombreOriginalSeguro(""), "entrega");

  const largo = `${"a".repeat(300)}.pdf`;
  const recortado = nombreOriginalSeguro(largo);
  assert.equal(recortado.length, 255);
  assert.ok(recortado.endsWith(".pdf"));
});
