// tarjetas.ts — Arma la sesión de repaso del día a partir del MAZO y el
// progreso Leitner. PURO. El mazo lo produce generar-tarjetas (determinista o
// IA); aquí solo se elige qué tarjeta mostrar por nodo y qué toca hoy.
import type { Arbol, NodoArbol } from "../arbol/types";
import { estadoInicial, tocaHoy, type ProgresoNodo } from "./leitner";
import { generarMazoDeterminista } from "./generar-tarjetas";
import type { Mazo, Tarjeta } from "./tipos-tarjeta";

export type MapaProgreso = Record<string, ProgresoNodo>;

export interface TarjetaSesion {
  tarjeta: Tarjeta;
  progreso: ProgresoNodo;
  ruta: string;   // contexto: Raíz › … › nodo
}

function rutaTexto(a: Arbol, nodo: NodoArbol): string {
  const porId = new Map(a.nodos.map(n => [n.id, n]));
  const partes: string[] = [];
  let actual: NodoArbol | undefined = nodo;
  while (actual) {
    partes.unshift(actual.texto || "(sin texto)");
    actual = actual.padreId ? porId.get(actual.padreId) : undefined;
  }
  return partes.join(" › ");
}

// Una tarjeta representativa por nodo: prefiere la de opción múltiple (más
// exigente) y, si no, la de voltear. Así un nodo = una entrada en la sesión,
// y el progreso Leitner sigue siendo por nodo.
function tarjetaPorNodo(mazo: Mazo): Map<string, Tarjeta> {
  const elegida = new Map<string, Tarjeta>();
  for (const t of mazo) {
    const actual = elegida.get(t.nodoId);
    if (!actual || (actual.tipo === "voltear" && t.tipo === "opcion")) elegida.set(t.nodoId, t);
  }
  return elegida;
}

/** La sesión de hoy (nuevas + vencidas), las más frágiles primero. */
export function sesionDeHoy(a: Arbol, mazo: Mazo, progreso: MapaProgreso, hoy: string): TarjetaSesion[] {
  const porNodo = tarjetaPorNodo(mazo);
  const idsConTexto = new Set(a.nodos.filter(n => n.texto.trim()).map(n => n.id));
  const porId = new Map(a.nodos.map(n => [n.id, n]));
  const sesion: TarjetaSesion[] = [];
  for (const [nodoId, tarjeta] of porNodo) {
    if (!idsConTexto.has(nodoId)) continue; // nodo borrado/sin texto: la tarjeta queda obsoleta
    const progresoNodo = progreso[nodoId] ?? estadoInicial(hoy);
    if (!tocaHoy(progresoNodo, hoy)) continue;
    sesion.push({ tarjeta, progreso: progresoNodo, ruta: rutaTexto(a, porId.get(nodoId)!) });
  }
  return sesion.sort((x, y) => x.progreso.caja - y.progreso.caja);
}

export function pendientesHoy(a: Arbol, mazo: Mazo, progreso: MapaProgreso, hoy: string): number {
  return sesionDeHoy(a, mazo, progreso, hoy).length;
}

/** El mazo a usar: el guardado si existe, o uno determinista al vuelo (nunca vacío). */
export function mazoOEffectivo(a: Arbol, guardado: Mazo | null): Mazo {
  return guardado && guardado.length ? guardado : generarMazoDeterminista(a);
}
