import { describe, expect, it } from "vitest";
import { recortar } from "./texto";

describe("recortar", () => {
  it("texto corto pasa intacto y sin marca", () => {
    const r = recortar("  hola mundo  ");
    expect(r.texto).toBe("hola mundo");
    expect(r.recortado).toBe(false);
  });

  it("texto largo se corta a max y marca recortado", () => {
    const r = recortar("a".repeat(100), 10);
    expect(r.texto.length).toBe(10);
    expect(r.recortado).toBe(true);
  });
});
