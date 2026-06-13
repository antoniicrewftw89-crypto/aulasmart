import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { generarSlidesMd } from "./slides";

const arma = () => {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1, nodo: s1 } = agregarHijo(a0, raizDe(a0).id, "Definición");
  const { arbol: a2, nodo: sub } = agregarHijo(a1, s1.id, "épsilon-delta");
  const { arbol: a3, nodo: s2 } = agregarHijo(a2, raizDe(a2).id, "Límites laterales");
  const a4 = editarNodo(a3, sub.id, { notas: "para todo épsilon existe delta", fuentes: ["Stewart cap. 2"] });
  return editarNodo(a4, s2.id, { estado: "dudoso" });
};

describe("generarSlidesMd", () => {
  it("estructura Marp: frontmatter marp, portada y una slide por rama", () => {
    const md = generarSlidesMd(arma());
    expect(md).toContain("marp: true");
    expect(md).toContain("origen: aulasmart");
    expect(md).toContain("# Límites");            // portada
    expect(md).toContain("## 1. Definición");     // primera rama
    expect(md).toContain("## 2. ⚠️ Límites laterales"); // dudoso marcado
    expect(md).toContain("- épsilon-delta");      // subnodo como viñeta
    expect(md).toContain("\n\n---\n\n");          // separador de slides Marp
  });

  it("incluye índice, slide de repaso para dudosos y fuentes", () => {
    const md = generarSlidesMd(arma());
    expect(md).toContain("## Índice");
    expect(md).toContain("## ⚠️ Repasar / verificar");
    expect(md).toContain("- Límites laterales");
    expect(md).toContain("## Fuentes");
    expect(md).toContain("Stewart cap. 2");
  });

  it("sin dudosos ni fuentes no añade esas slides", () => {
    const a0 = crearArbol("x", "y", "Tema");
    const { arbol } = agregarHijo(a0, raizDe(a0).id, "Punto");
    const md = generarSlidesMd(arbol);
    expect(md).not.toContain("Repasar / verificar");
    expect(md).not.toContain("## Fuentes");
    expect(md).toContain("# Tema");
  });
});
