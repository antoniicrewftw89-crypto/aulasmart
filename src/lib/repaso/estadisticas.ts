// estadisticas.ts — Resumen del estado de estudio de un árbol. PURO.
// Mira el progreso Leitner por nodo y lo agrega en algo que la UI (y Janus, vía
// el CLI de pendientes) pueden mostrar de un vistazo: cuántas tarjetas hay en
// cada caja, cuántas dominadas y cuántas tocan hoy.
import type { Arbol } from "../arbol/types";
import { estadoInicial } from "./leitner";
import type { Mazo } from "./tipos-tarjeta";
import { pendientesHoy, type MapaProgreso } from "./tarjetas";

export interface ResumenRepaso {
  total: number;        // nodos con texto que tienen tarjeta en el mazo
  porCaja: number[];    // longitud 5: cuántos nodos viven en cada caja 1..5
  dominado: number;     // nodos en la caja 5 (el % se calcula en la UI)
  vistas: number;       // nodos repasados al menos una vez (aciertos+fallos > 0)
  pendientesHoy: number;
}

export function resumenRepaso(a: Arbol, mazo: Mazo, progreso: MapaProgreso, hoy: string): ResumenRepaso {
  const idsEnMazo = new Set(mazo.map(t => t.nodoId));
  const nodos = a.nodos.filter(n => n.texto.trim() && idsEnMazo.has(n.id));

  const porCaja = [0, 0, 0, 0, 0];
  let vistas = 0;
  for (const n of nodos) {
    const p = progreso[n.id] ?? estadoInicial(hoy);
    const caja = Math.min(Math.max(p.caja, 1), 5);
    porCaja[caja - 1]++;
    if (p.aciertos + p.fallos > 0) vistas++;
  }

  return {
    total: nodos.length,
    porCaja,
    dominado: porCaja[4],
    vistas,
    pendientesHoy: pendientesHoy(a, mazo, progreso, hoy),
  };
}
