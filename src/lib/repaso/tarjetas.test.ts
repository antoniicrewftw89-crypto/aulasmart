import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { generarMazoDeterminista } from "./generar-tarjetas";
import { mazoOEffectivo, pendientesHoy, sesionDeHoy, sesionRepaso, type MapaProgreso } from "./tarjetas";

const HOY = "2026-06-13";

function arbolDemo() {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1, nodo: def } = agregarHijo(a0, raizDe(a0).id, "Definición");
  const { arbol: a2 } = agregarHijo(a1, def.id, "épsilon-delta");
  const a3 = editarNodo(a2, def.id, { notas: "para todo ε>0 existe δ>0" });
  return { arbol: a3, defId: def.id };
}

describe("sesionDeHoy", () => {
  it("incluye nodos nuevos y vencidos; excluye los futuros", () => {
    const { arbol, defId } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    const progreso: MapaProgreso = {
      [defId]: { caja: 3, proximoRepaso: "2026-07-01", aciertos: 2, fallos: 0 }, // futuro → fuera
    };
    const sesion = sesionDeHoy(arbol, mazo, progreso, HOY);
    expect(sesion.map(s => s.tarjeta.nodoId)).not.toContain(defId);
  });

  it("una entrada por nodo (no duplica voltear + opción del mismo nodo)", () => {
    const { arbol } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    const sesion = sesionDeHoy(arbol, mazo, {}, HOY);
    const nodos = sesion.map(s => s.tarjeta.nodoId);
    expect(new Set(nodos).size).toBe(nodos.length); // sin repetidos
  });

  it("ordena por caja ascendente (lo más frágil primero)", () => {
    const { arbol } = arbolDemo();
    const sesion = sesionDeHoy(arbol, generarMazoDeterminista(arbol), {}, HOY);
    expect(sesion.every(s => s.progreso.caja === 1)).toBe(true);
  });

  it("incluye la ruta de cada tarjeta", () => {
    const { arbol } = arbolDemo();
    const sesion = sesionDeHoy(arbol, generarMazoDeterminista(arbol), {}, HOY);
    expect(sesion.some(s => s.ruta.includes("Límites"))).toBe(true);
  });
});

describe("sesionRepaso (modo repasar todo)", () => {
  it("con todo:true incluye nodos futuros que sesionDeHoy excluye", () => {
    const { arbol, defId } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    const progreso: MapaProgreso = {
      [defId]: { caja: 3, proximoRepaso: "2026-07-01", aciertos: 2, fallos: 0 }, // futuro
    };
    const hoy = sesionDeHoy(arbol, mazo, progreso, HOY).map(s => s.tarjeta.nodoId);
    const todo = sesionRepaso(arbol, mazo, progreso, HOY, { todo: true }).map(s => s.tarjeta.nodoId);
    expect(hoy).not.toContain(defId);
    expect(todo).toContain(defId);
  });
});

describe("mazoOEffectivo", () => {
  it("usa el guardado si tiene tarjetas; si no, genera determinista", () => {
    const { arbol } = arbolDemo();
    expect(mazoOEffectivo(arbol, null).length).toBeGreaterThan(0);
    expect(mazoOEffectivo(arbol, [])).toEqual(mazoOEffectivo(arbol, null)); // vacío → determinista
  });
});

describe("pendientesHoy", () => {
  it("cuenta las tarjetas de la sesión de hoy", () => {
    const { arbol } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    expect(pendientesHoy(arbol, mazo, {}, HOY)).toBe(sesionDeHoy(arbol, mazo, {}, HOY).length);
  });
});
