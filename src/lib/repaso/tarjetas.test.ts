import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { construirMazo, sesionDeHoy, type MapaProgreso } from "./tarjetas";

const HOY = "2026-06-12";

function arbolDemo() {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1, nodo: def } = agregarHijo(a0, raizDe(a0).id, "Definición");
  const { arbol: a2 } = agregarHijo(a1, def.id, "épsilon-delta");
  const a3 = editarNodo(a2, def.id, { notas: "para todo ε>0 existe δ>0" });
  return { arbol: a3, defId: def.id };
}

describe("construirMazo", () => {
  it("una tarjeta por nodo con texto; anverso = idea, reverso = notas + sub-conceptos", () => {
    const { arbol, defId } = arbolDemo();
    const mazo = construirMazo(arbol);
    expect(mazo).toHaveLength(3); // raíz + Definición + épsilon-delta
    const carta = mazo.find(c => c.nodoId === defId)!;
    expect(carta.anverso).toBe("Definición");
    expect(carta.reverso).toContain("para todo ε>0");
    expect(carta.reverso).toContain("épsilon-delta"); // el hijo aparece como sub-concepto
    expect(carta.ruta).toBe("Límites › Definición");
  });

  it("ignora nodos sin texto", () => {
    const a0 = crearArbol("x", "y", "Raíz");
    const { arbol } = agregarHijo(a0, raizDe(a0).id, "   "); // vacío
    expect(construirMazo(arbol)).toHaveLength(1);
  });
});

describe("sesionDeHoy", () => {
  it("incluye nodos nunca vistos (entran como nuevos) y los vencidos; excluye los futuros", () => {
    const { arbol, defId } = arbolDemo();
    const progreso: MapaProgreso = {
      [defId]: { caja: 3, proximoRepaso: "2026-07-01", aciertos: 2, fallos: 0 }, // futuro → fuera
    };
    const sesion = sesionDeHoy(arbol, progreso, HOY);
    const ids = sesion.map(c => c.nodoId);
    expect(ids).not.toContain(defId);          // su repaso es en julio
    expect(sesion.length).toBe(2);             // raíz y épsilon-delta, nuevos
  });

  it("ordena por caja ascendente (lo más frágil primero)", () => {
    const { arbol } = arbolDemo();
    const sesion = sesionDeHoy(arbol, {}, HOY); // todos nuevos = caja 1
    expect(sesion.every(c => c.progreso.caja === 1)).toBe(true);
  });
});
