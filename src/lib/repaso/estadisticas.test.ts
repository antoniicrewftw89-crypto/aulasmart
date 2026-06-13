import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { generarMazoDeterminista } from "./generar-tarjetas";
import { resumenRepaso } from "./estadisticas";
import type { MapaProgreso } from "./tarjetas";

const HOY = "2026-06-13";

function arbolDemo() {
  const a0 = crearArbol("calculo", "limites", "Límites");
  const { arbol: a1, nodo: def } = agregarHijo(a0, raizDe(a0).id, "Definición");
  const { arbol: a2, nodo: eps } = agregarHijo(a1, def.id, "épsilon-delta");
  const a3 = editarNodo(a2, def.id, { notas: "para todo ε>0 existe δ>0" });
  return { arbol: a3, defId: def.id, epsId: eps.id };
}

describe("resumenRepaso", () => {
  it("sin progreso: todo en caja 1, nada dominado ni visto, todo pendiente", () => {
    const { arbol } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    const r = resumenRepaso(arbol, mazo, {}, HOY);
    expect(r.total).toBe(3); // raíz + Definición + épsilon-delta
    expect(r.porCaja[0]).toBe(3);
    expect(r.dominado).toBe(0);
    expect(r.vistas).toBe(0);
    expect(r.pendientesHoy).toBe(3);
  });

  it("un nodo dominado (caja 5, futuro) cuenta como dominado y no como pendiente", () => {
    const { arbol, defId } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    const progreso: MapaProgreso = {
      [defId]: { caja: 5, proximoRepaso: "2026-07-01", aciertos: 5, fallos: 1 },
    };
    const r = resumenRepaso(arbol, mazo, progreso, HOY);
    expect(r.dominado).toBe(1);
    expect(r.porCaja[4]).toBe(1);
    expect(r.vistas).toBe(1);
    expect(r.pendientesHoy).toBe(2);
  });

  it("porCaja siempre suma el total", () => {
    const { arbol, defId, epsId } = arbolDemo();
    const mazo = generarMazoDeterminista(arbol);
    const progreso: MapaProgreso = {
      [defId]: { caja: 2, proximoRepaso: HOY, aciertos: 1, fallos: 0 },
      [epsId]: { caja: 5, proximoRepaso: "2026-07-01", aciertos: 5, fallos: 0 },
    };
    const r = resumenRepaso(arbol, mazo, progreso, HOY);
    expect(r.porCaja.reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(r.vistas).toBe(2);
  });
});
