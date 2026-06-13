import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import type { Arbol } from "../arbol/types";
import {
  aplicarMazoIA,
  construirPromptMazo,
  EsquemaMazoIA,
  generarMazoDeterminista,
} from "./generar-tarjetas";
import { opcionValida, type TarjetaOpcion } from "./tipos-tarjeta";

// Árbol con varios conceptos con notas (suficiente para opción múltiple).
function arbolRico(): Arbol {
  let a = crearArbol("calculo", "limites", "Límites");
  const raizId = raizDe(a).id;
  const conceptos: [string, string][] = [
    ["Límite", "valor al que se acerca f(x) cuando x→a"],
    ["Continuidad", "no hay saltos ni huecos en la gráfica"],
    ["Derivada", "pendiente de la recta tangente"],
    ["Integral", "área bajo la curva"],
  ];
  for (const [texto, notas] of conceptos) {
    const r = agregarHijo(a, raizId, texto);
    a = editarNodo(r.arbol, r.nodo.id, { notas });
  }
  return a;
}

describe("generarMazoDeterminista", () => {
  it("crea una tarjeta 'voltear' por cada nodo con texto", () => {
    const mazo = generarMazoDeterminista(arbolRico());
    const volteos = mazo.filter(t => t.tipo === "voltear");
    expect(volteos.length).toBe(5); // raíz + 4 conceptos
  });

  it("crea opción múltiple con 4 opciones, una correcta y 3 distractores del árbol", () => {
    const mazo = generarMazoDeterminista(arbolRico());
    const opciones = mazo.filter(t => t.tipo === "opcion") as TarjetaOpcion[];
    expect(opciones.length).toBeGreaterThan(0);
    for (const o of opciones) {
      expect(opcionValida(o)).toBe(true);
      // la opción correcta es el texto del nodo de la tarjeta
      expect(o.opciones[o.correcta].length).toBeGreaterThan(0);
      // las 4 opciones son distintas entre sí
      expect(new Set(o.opciones).size).toBe(4);
    }
  });

  it("no genera opción múltiple si no hay 4 conceptos distintos", () => {
    let a = crearArbol("x", "y", "Solo");
    const r = agregarHijo(a, raizDe(a).id, "uno");
    a = editarNodo(r.arbol, r.nodo.id, { notas: "algo" });
    const mazo = generarMazoDeterminista(a);
    expect(mazo.filter(t => t.tipo === "opcion").length).toBe(0);
  });

  it("la posición de la respuesta correcta no es siempre la misma", () => {
    const opciones = generarMazoDeterminista(arbolRico()).filter(t => t.tipo === "opcion") as TarjetaOpcion[];
    const posiciones = new Set(opciones.map(o => o.correcta));
    expect(posiciones.size).toBeGreaterThan(1); // varía según el nodo
  });
});

describe("construirPromptMazo", () => {
  it("incluye la materia y los nodos con sus notas", () => {
    const { system, prompt } = construirPromptMazo(arbolRico());
    expect(system.toLowerCase()).toContain("español");
    expect(prompt).toContain("Derivada");
    expect(prompt).toContain("área bajo la curva");
    expect(prompt.toLowerCase()).toContain("opción múltiple");
  });
});

describe("aplicarMazoIA", () => {
  it("convierte la respuesta de la IA en tarjetas, descartando las inválidas", () => {
    const a = arbolRico();
    const nodoOk = a.nodos[1].id;
    const respuesta = {
      preguntas: [
        { nodoId: nodoOk, pregunta: "¿Qué es un límite?", opciones: ["a", "b", "c", "d"], correcta: 2, explica: "porque sí" },
        { nodoId: "no-existe", pregunta: "x", opciones: ["a", "b", "c", "d"], correcta: 0, explica: "" }, // nodo inexistente
        { nodoId: nodoOk, pregunta: "mala", opciones: ["a", "b"], correcta: 0, explica: "" }, // pocas opciones
      ],
    };
    const mazo = aplicarMazoIA(a, respuesta);
    expect(mazo.length).toBe(1);
    expect(mazo[0]).toMatchObject({ nodoId: nodoOk, tipo: "opcion", correcta: 2 });
  });

  it("el esquema Zod valida la forma esperada", () => {
    const ok = EsquemaMazoIA.safeParse({
      preguntas: [{ nodoId: "n", pregunta: "p", opciones: ["a", "b", "c", "d"], correcta: 1, explica: "e" }],
    });
    expect(ok.success).toBe(true);
  });
});
