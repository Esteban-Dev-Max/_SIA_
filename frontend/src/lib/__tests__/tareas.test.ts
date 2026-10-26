import { describe, expect, it } from "vitest";
import { PUNTAJE_MAX_TAREA, validarPuntajeMaximo } from "../tareas";

describe("validarPuntajeMaximo", () => {
  it("acepta valores dentro del rango permitido", () => {
    expect(validarPuntajeMaximo("5")).toBeNull();
    expect(validarPuntajeMaximo("4.5")).toBeNull();
    expect(validarPuntajeMaximo("1")).toBeNull();
    expect(validarPuntajeMaximo(5)).toBeNull();
  });

  it("rechaza valores mayores al máximo", () => {
    expect(validarPuntajeMaximo("5.5")).toMatch(/no puede superar 5/);
    expect(validarPuntajeMaximo("10")).toMatch(/no puede superar 5/);
    expect(validarPuntajeMaximo(100)).toMatch(/no puede superar 5/);
  });

  it("rechaza valores por debajo del mínimo y textos no numéricos", () => {
    expect(validarPuntajeMaximo("0")).toMatch(/mayor o igual a 1/);
    expect(validarPuntajeMaximo("-3")).toMatch(/mayor o igual a 1/);
    expect(validarPuntajeMaximo("abc")).toMatch(/debe ser un número/);
  });

  it("considera válido el valor vacío (se usa el máximo por defecto)", () => {
    expect(validarPuntajeMaximo("")).toBeNull();
    expect(validarPuntajeMaximo("   ")).toBeNull();
    expect(validarPuntajeMaximo(null)).toBeNull();
    expect(validarPuntajeMaximo(undefined)).toBeNull();
  });

  it("el máximo permitido es 5", () => {
    expect(PUNTAJE_MAX_TAREA).toBe(5);
  });
});
