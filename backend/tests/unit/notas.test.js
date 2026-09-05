import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PONDERACION,
  CAMPOS_NOTA,
  normalizarNumero,
  notasCompletas,
  calcularDefinitiva,
} from "../../lib/notas.js";

test("PONDERACION suma 1 y cubre los 4 campos", () => {
  assert.equal(CAMPOS_NOTA.length, 4);
  const total = CAMPOS_NOTA.reduce((s, c) => s + PONDERACION[c], 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("calcularDefinitiva aplica 25/25/20/30 correctamente", () => {
  // 4.0*0.25 + 3.5*0.25 + 4.5*0.20 + 4.0*0.30 = 1.0 + 0.875 + 0.9 + 1.2 = 3.975 -> 3.98
  const notas = { nota_1: 4.0, nota_2: 3.5, nota_3: 4.5, examen_final: 4.0 };
  assert.equal(calcularDefinitiva(notas), 3.98);
});

test("calcularDefinitiva devuelve null si falta alguna nota", () => {
  assert.equal(
    calcularDefinitiva({ nota_1: 4.0, nota_2: null, nota_3: 4, examen_final: 4 }),
    null,
  );
  assert.equal(calcularDefinitiva({ nota_1: 4 }), null);
});

test("notasCompletas acepta rango [0,5] y rechaza fuera de rango", () => {
  const base = { nota_1: 1, nota_2: 2, nota_3: 3, examen_final: 4 };
  assert.equal(notasCompletas(base), true);
  assert.equal(notasCompletas({ ...base, nota_1: -1 }), false);
  assert.equal(notasCompletas({ ...base, examen_final: 5.1 }), false);
  assert.equal(notasCompletas({ ...base, nota_3: null }), false);
});

test("normalizarNumero convierte valores vacíos a null", () => {
  assert.equal(normalizarNumero(""), null);
  assert.equal(normalizarNumero(null), null);
  assert.equal(normalizarNumero(undefined), null);
  assert.equal(normalizarNumero("nan"), null);
  assert.equal(normalizarNumero(3.5), 3.5);
  assert.equal(normalizarNumero("4"), 4);
});
