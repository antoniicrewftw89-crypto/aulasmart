import { describe, expect, it } from "vitest";
import { trocear } from "./trocear";

describe("trocear", () => {
  it("texto corto: un solo trozo", () => {
    expect(trocear("hola mundo")).toEqual(["hola mundo"]);
  });

  it("vacío: sin trozos", () => {
    expect(trocear("   ")).toEqual([]);
  });

  it("texto largo: varios trozos, cada uno bajo el máximo", () => {
    const texto = Array.from({ length: 60 }, (_, i) =>
      `Párrafo ${i} con bastante relleno para ocupar espacio en el documento.`).join("\n\n");
    const trozos = trocear(texto, { maxChars: 300, solapeChars: 50 });
    expect(trozos.length).toBeGreaterThan(1);
    expect(trozos.every(t => t.length <= 300)).toBe(true);
  });

  it("cubre todo el contenido (principio y fin aparecen)", () => {
    const texto = "INICIO " + "palabra ".repeat(300) + "FINAL";
    const trozos = trocear(texto, { maxChars: 200, solapeChars: 30 });
    const junto = trozos.join(" ");
    expect(junto).toContain("INICIO");
    expect(junto).toContain("FINAL");
  });
});
