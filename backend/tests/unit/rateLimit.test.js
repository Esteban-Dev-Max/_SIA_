import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  estaBloqueado,
  registrarFallo,
  limpiarBloqueo,
} from "../../lib/rateLimit.js";

// El estado del rate-limit vive en un Map en memoria del módulo; como no se
// expone un reset, estos tests usan claves únicas por caso para evitar
// dependencia entre tests.
let i = 0;
const clave = () => `correo${++i}@test.co|1.2.3.4`;

test("no bloquea con pocos fallos", () => {
  const k = clave();
  for (let n = 0; n < 4; n++) registrarFallo(...k.split("|"));
  assert.equal(estaBloqueado(...k.split("|")), false);
});

test("bloquea al superar el máximo de fallos (5)", () => {
  const k = clave();
  for (let n = 0; n < 5; n++) registrarFallo(...k.split("|"));
  assert.equal(estaBloqueado(...k.split("|")), true);
});

test("limpiarBloqueo desbloquea la combinación", () => {
  const k = clave();
  for (let n = 0; n < 5; n++) registrarFallo(...k.split("|"));
  assert.equal(estaBloqueado(...k.split("|")), true);
  limpiarBloqueo(...k.split("|"));
  assert.equal(estaBloqueado(...k.split("|")), false);
});

test("combina correo e IP: el bloqueo es por par", () => {
  const [correo, ip] = clave().split("|");
  // Fallos solo desde una IP; otra IP del mismo correo no debe quedar bloqueada.
  for (let n = 0; n < 5; n++) registrarFallo(correo, ip);
  assert.equal(estaBloqueado(correo, ip), true);
  assert.equal(estaBloqueado(correo, "9.9.9.9"), false);
});
