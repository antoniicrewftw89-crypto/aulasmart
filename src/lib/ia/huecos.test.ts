import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, hijosDe, raizDe } from "../arbol/modelo";
import { aplicarHuecos, filtrarHuecos } from "./huecos";
import type { Outline } from "../ingesta/esquema";

function arbolDemo() {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1 } = agregarHijo(a0, raizDe(a0).id, "Definición");
  const { arbol: a2 } = agregarHijo(a1, raizDe(a1).id, "Límites laterales");
  return a2;
}

describe("filtrarHuecos", () => {
  it("descarta los conceptos que ya están (aunque difieran tildes/caja)", () => {
    const a = arbolDemo();
    const propuesto = [
      { texto: "definición" },       // ya existe → fuera
      { texto: "Continuidad" },      // nuevo → entra
      { texto: "límites LATERALES" },// ya existe → fuera
    ];
    expect(filtrarHuecos(a, propuesto).map(n => n.texto)).toEqual(["Continuidad"]);
  });

  it("filtra recursivamente los hijos duplicados", () => {
    const a = arbolDemo();
    const propuesto = [
      { texto: "Tipos", hijos: [{ texto: "Definición" }, { texto: "Infinitos" }] },
    ];
    const r = filtrarHuecos(a, propuesto);
    expect(r[0].hijos?.map(h => h.texto)).toEqual(["Infinitos"]); // "Definición" se cae
  });
});

describe("aplicarHuecos", () => {
  it("añade solo lo nuevo bajo la raíz, en estado borrador", () => {
    const a = arbolDemo();
    const antes = a.nodos.length;
    const outline: Outline = { titulo: "Límites", ramas: [{ texto: "Definición" }, { texto: "Continuidad" }] };
    const out = aplicarHuecos(a, outline);
    expect(out.nodos.length).toBe(antes + 1); // solo "Continuidad"
    const nuevos = hijosDe(out, raizDe(out).id).map(n => n.texto);
    expect(nuevos).toContain("Continuidad");
    expect(out.nodos.every(n => n.estado === "borrador")).toBe(true);
  });
});
