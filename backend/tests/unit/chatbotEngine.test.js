import { test } from "node:test";
import assert from "node:assert/strict";
import {
  norm,
  contiene,
  detectarIntento,
  guiasBasicas,
} from "../../lib/chatbotEngine.js";

test("norm quita tildes y pasa a minúsculas (conserva puntuación)", () => {
  assert.equal(norm("¿Cómo está?"), "¿como esta?");
  assert.equal(norm("CALIFICACIÓN"), "calificacion");
});

test("contiene detecta cualquiera de las palabras", () => {
  assert.equal(contiene("quiero ver mis notas", "nota", "puntaje"), true);
  assert.equal(contiene("hola profe", "notas", "nota"), false);
});

test("detectarIntento reconoce saludo", () => {
  assert.equal(detectarIntento("hola buenas tardes"), "saludo");
});

test("detectarIntento reconoce intención de notas", () => {
  assert.equal(detectarIntento("¿cómo veo mis calificaciones?"), "notas");
});

test("guiasBasicas expone guías por intento y una por defecto", () => {
  const guias = guiasBasicas();
  assert.equal(typeof guias, "object");
  assert.equal(typeof guias.notas, "string");
  assert.ok(guias.notas.length > 0);
  assert.equal(typeof guias.default, "string");
});
