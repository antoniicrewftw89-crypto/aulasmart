import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, raizDe } from "../arbol/modelo";
import { aplicarRespuesta, construirPrompt, type RespuestaIA } from "./acciones-nodo";

const arma = () => {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "el límite siempre existe");
  return { a: a1, h };
};

describe("construirPrompt", () => {
  it("verificar incluye la ruta, el texto del nodo y pide evaluación", () => {
    const { a, h } = arma();
    const { system, prompt } = construirPrompt("verificar", a, h);
    expect(system).toContain("español");
    expect(prompt).toContain("Límites > el límite siempre existe");
    expect(prompt.toLowerCase()).toContain("evalúa");
  });

  it("investigar pide profundizar, no evaluar", () => {
    const { a, h } = arma();
    const { prompt } = construirPrompt("investigar", a, h);
    expect(prompt.toLowerCase()).toContain("profundiza");
  });
});

describe("aplicarRespuesta", () => {
  const r: RespuestaIA = {
    veredicto: "incorrecto",
    explicacion: "No: hay límites que no existen (oscilación, laterales distintos).",
    fuentes: ["https://es.wikipedia.org/wiki/Límite_(matemática)"],
    estadoSugerido: "dudoso",
  };

  it("escribe el bloque IA en notas, une fuentes y cambia el estado", () => {
    const { a, h } = arma();
    const a2 = aplicarRespuesta(a, h.id, r, "2026-06-12T10:00:00.000Z");
    const nodo = a2.nodos.find(n => n.id === h.id)!;
    expect(nodo.notas).toContain("— IA (2026-06-12) [incorrecto] —");
    expect(nodo.notas).toContain("oscilación");
    expect(nodo.fuentes).toEqual(r.fuentes);
    expect(nodo.estado).toBe("dudoso");
    // el resto del árbol queda intacto
    expect(a2.nodos.find(n => n.padreId === null)!.notas).toBe("");
  });

  it("no duplica fuentes y estadoSugerido null conserva el estado", () => {
    const { a, h } = arma();
    const a2 = aplicarRespuesta(a, h.id, r, "2026-06-12T10:00:00.000Z");
    const a3 = aplicarRespuesta(a2, h.id, { ...r, veredicto: "ampliado", estadoSugerido: null }, "2026-06-13T10:00:00.000Z");
    const nodo = a3.nodos.find(n => n.id === h.id)!;
    expect(nodo.fuentes).toHaveLength(1);
    expect(nodo.estado).toBe("dudoso"); // se conservó
    expect(nodo.notas).toContain("[ampliado]");
  });
});
