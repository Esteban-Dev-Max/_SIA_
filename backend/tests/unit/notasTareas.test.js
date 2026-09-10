import { test } from "node:test";
import assert from "node:assert/strict";
import { reescalarNota, promedioNotas } from "../../lib/notasTareas.js";

test("reescalarNota convierte de la escala de tarea a 0.0–5.0", () => {
  assert.equal(reescalarNota(9, 10), 4.5);
  assert.equal(reescalarNota(10, 10), 5);
  assert.equal(reescalarNota(0, 10), 0);
  assert.equal(reescalarNota(5, 20), 1.25);
  assert.equal(reescalarNota(3, 7), 2.14); // 3/7*5 = 2.1428… -> redondea a 2
});

test("reescalarNota devuelve null sin calificación o con puntaje inválido", () => {
  assert.equal(reescalarNota(null, 10), null);
  assert.equal(reescalarNota(undefined, 10), null);
  assert.equal(reescalarNota(8, 0), null);
  assert.equal(reescalarNota(8, -2), null);
  assert.equal(reescalarNota("abc", 10), null);
});

test("promedioNotas promedia las notas reescaladas", () => {
  const entregas = [
    { calificacion: 9, puntaje_max: 10 }, // 4.5
    { calificacion: 10, puntaje_max: 10 }, // 5.0
    { calificacion: 5, puntaje_max: 20 }, // 1.25
  ];
  // (4.5 + 5 + 1.25) / 3 = 3.5833… -> 3.58
  assert.equal(promedioNotas(entregas), 3.58);
});

test("promedioNotas ignora entregas sin calificación y devuelve null si no hay ninguna", () => {
  const conNula = [
    { calificacion: 9, puntaje_max: 10 },
    { calificacion: null, puntaje_max: 10 },
  ];
  assert.equal(promedioNotas(conNula), 4.5);
  assert.equal(promedioNotas([]), null);
  assert.equal(promedioNotas([{ calificacion: null, puntaje_max: 10 }]), null);
});

test("promedioNotas redondea a 2 decimales con el mismo criterio que la definitiva", () => {
  // 8/10*5 = 4.0 ; 4/8*5 = 2.5 -> promedio 3.25
  const entregas = [
    { calificacion: 8, puntaje_max: 10 },
    { calificacion: 4, puntaje_max: 8 },
  ];
  assert.equal(promedioNotas(entregas), 3.25);
});