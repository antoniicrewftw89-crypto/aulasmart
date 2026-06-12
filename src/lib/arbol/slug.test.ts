import { describe, expect, it } from "vitest";
import { slugificar } from "./slug";

describe("slugificar", () => {
  it("pasa a minúsculas y guiones", () => {
    expect(slugificar("Cálculo Diferencial")).toBe("calculo-diferencial");
  });
  it("limpia símbolos y bordes", () => {
    expect(slugificar("  ¡Límites & Derivadas! ")).toBe("limites-derivadas");
  });
  it("nunca devuelve vacío", () => {
    expect(slugificar("¿?¡!")).toBe("sin-titulo");
  });
});
