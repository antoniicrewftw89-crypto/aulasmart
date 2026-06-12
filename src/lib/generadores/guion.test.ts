import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { generarGuionMd } from "./guion";

const arma = () => {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1, nodo: s1 } = agregarHijo(a0, raizDe(a0).id, "Definición");
  const { arbol: a2, nodo: sub } = agregarHijo(a1, s1.id, "épsilon-delta");
  const { arbol: a3, nodo: s2 } = agregarHijo(a2, raizDe(a2).id, "Límites laterales");
  const a4 = editarNodo(a3, sub.id, { notas: "para todo épsilon existe delta", fuentes: ["Stewart cap. 2"] });
  return editarNodo(a4, s2.id, { estado: "dudoso" });
};

describe("generarGuionMd", () => {
  it("estructura: frontmatter, una sección por rama principal y subpuntos anidados", () => {
    const md = generarGuionMd(arma());
    expect(md).toContain("origen: aulasmart");
    expect(md).toContain("# Guion de estudio — Límites");
    expect(md).toContain("## 1. Definición");
    expect(md).toContain("## 2. ⚠️ Límites laterales");
    expect(md).toContain("- épsilon-delta");
    expect(md).toContain("para todo épsilon existe delta");
  });

  it("los dudosos quedan marcados y van al checklist de repaso", () => {
    const md = generarGuionMd(arma());
    expect(md).toContain("⚠️");
    expect(md).toContain("## Checklist de repaso");
    expect(md).toContain("- [ ] Límites laterales");
  });

  it("agrega las fuentes al final con su punto", () => {
    const md = generarGuionMd(arma());
    expect(md).toContain("## Fuentes");
    expect(md).toContain("Stewart cap. 2 (épsilon-delta)");
  });
});
