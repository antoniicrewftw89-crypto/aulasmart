import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, hijosDe, raizDe } from "../arbol/modelo";
import { aplicarOutline, construirArbolIngesta, type RespuestaIngesta } from "./esquema";

const resp: RespuestaIngesta = {
  titulo: "Límites",
  ramas: [
    { texto: "Definición", notas: "idea ε-δ", hijos: [{ texto: "épsilon-delta" }] },
    { texto: "Tipos", hijos: [{ texto: "Laterales" }, { texto: "Infinitos" }] },
  ],
};

describe("construirArbolIngesta", () => {
  it("raíz = título, ramas y subpuntos anidados, todo en borrador", () => {
    const a = construirArbolIngesta("ingesta", "limites", resp);
    const raiz = raizDe(a);
    expect(raiz.texto).toBe("Límites");
    expect(a.titulo).toBe("Límites");

    const ramas = hijosDe(a, raiz.id);
    expect(ramas.map(r => r.texto)).toEqual(["Definición", "Tipos"]);
    expect(ramas[0].notas).toBe("idea ε-δ");
    expect(hijosDe(a, ramas[0].id).map(n => n.texto)).toEqual(["épsilon-delta"]);
    expect(hijosDe(a, ramas[1].id).map(n => n.texto)).toEqual(["Laterales", "Infinitos"]);

    expect(a.nodos.every(n => n.estado === "borrador")).toBe(true);
  });

  it("título vacío cae a 'Sin título'", () => {
    const a = construirArbolIngesta("ingesta", "x", { titulo: "  ", ramas: [] });
    expect(raizDe(a).texto).toBe("Sin título");
  });
});

describe("aplicarOutline", () => {
  it("salta nodos sin texto pero reengancha sus hijos al padre", () => {
    const base = crearArbol("x", "y", "Raíz");
    const a = aplicarOutline(base, raizDe(base).id, [
      { texto: "", hijos: [{ texto: "rescatado" }] },
      { texto: "normal" },
    ]);
    const top = hijosDe(a, raizDe(a).id).map(n => n.texto);
    expect(top).toContain("rescatado"); // subió un nivel al saltarse el padre vacío
    expect(top).toContain("normal");
    expect(top).not.toContain("");
  });

  it("injerta bajo el nodo indicado (caso fusión)", () => {
    const base = crearArbol("m", "t", "Tema");
    const { arbol: conRama, nodo } = agregarHijo(base, raizDe(base).id, "Rama A");
    const a = aplicarOutline(conRama, nodo.id, [{ texto: "nuevo subpunto" }]);
    expect(hijosDe(a, nodo.id).map(n => n.texto)).toContain("nuevo subpunto");
  });
});
