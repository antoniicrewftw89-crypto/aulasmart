import { describe, expect, it } from "vitest";
import { agregarHijo, conectar, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { generarOutlineMd } from "./markdown";

describe("generarOutlineMd", () => {
  it("frontmatter compatible con la bóveda + aviso de autogenerado", () => {
    const md = generarOutlineMd(crearArbol("calculo", "limites", "Límites"));
    expect(md).toContain("proyecto: aulasmart");
    expect(md).toContain("origen: aulasmart");
    expect(md).toContain("tags: [estudio, calculo]");
    expect(md).toContain("No editar a mano");
  });

  it("outline anidado con estados y notas", () => {
    const a0 = crearArbol("calculo", "limites", "Límites");
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2 } = agregarHijo(a1, h.id, "épsilon-delta");
    const a3 = editarNodo(a2, h.id, { estado: "verificado", notas: "visto en clase" });
    const md = generarOutlineMd(a3);
    expect(md).toContain("- Límites");
    expect(md).toContain("  - ✅ definición");
    expect(md).toContain("    - _notas:_ visto en clase");
    expect(md).toContain("    - épsilon-delta");
  });

  it("lista las relaciones cruzadas", () => {
    const a0 = crearArbol("calculo", "limites", "Límites");
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2, nodo: h2 } = agregarHijo(a1, raizDe(a1).id, "continuidad");
    const a3 = conectar(a2, h.id, h2.id, "se usa en");
    expect(generarOutlineMd(a3)).toContain("definición → continuidad (se usa en)");
  });
});
