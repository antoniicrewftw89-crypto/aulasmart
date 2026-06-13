import { describe, expect, it } from "vitest";
import { fusionarOutlines } from "./fusionar-outline";
import type { Outline } from "./esquema";

describe("fusionarOutlines", () => {
  it("ramas con el mismo título (aunque difieran tildes/caja) funden sus hijos", () => {
    const a: Outline = { titulo: "Cálculo", ramas: [{ texto: "Límites", hijos: [{ texto: "Laterales" }] }] };
    const b: Outline = { titulo: "", ramas: [{ texto: "limites", hijos: [{ texto: "Infinitos" }] }] };
    const f = fusionarOutlines([a, b]);
    expect(f.titulo).toBe("Cálculo"); // primer título no vacío
    expect(f.ramas).toHaveLength(1);
    expect(f.ramas[0].hijos?.map(h => h.texto)).toEqual(["Laterales", "Infinitos"]);
  });

  it("ramas distintas se conservan en orden de aparición", () => {
    const a: Outline = { titulo: "T", ramas: [{ texto: "A" }] };
    const b: Outline = { titulo: "T", ramas: [{ texto: "B" }] };
    expect(fusionarOutlines([a, b]).ramas.map(r => r.texto)).toEqual(["A", "B"]);
  });

  it("conserva la primera nota no vacía al fundir", () => {
    const a: Outline = { titulo: "T", ramas: [{ texto: "X" }] };
    const b: Outline = { titulo: "T", ramas: [{ texto: "X", notas: "definición" }] };
    expect(fusionarOutlines([a, b]).ramas[0].notas).toBe("definición");
  });
});
