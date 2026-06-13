// tarjetas.ts — Convierte el árbol en un mazo de flashcards y arma la sesión
// de repaso del día. PURO. El árbol que TÚ construiste ya es el material:
// cada nodo con texto es una tarjeta, sin que la IA invente nada.
import type { Arbol, NodoArbol } from "../arbol/types";
import { hijosDe, raizDe } from "../arbol/modelo";
import { estadoInicial, tocaHoy, type ProgresoNodo } from "./leitner";

export type MapaProgreso = Record<string, ProgresoNodo>;

export interface Tarjeta {
  nodoId: string;
  anverso: string;   // la idea (texto del nodo)
  reverso: string;   // lo que sabes: notas + sub-conceptos
  ruta: string;      // contexto: Raíz › … › nodo
}

export interface TarjetaConProgreso extends Tarjeta {
  progreso: ProgresoNodo;
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

function reversoDe(a: Arbol, nodo: NodoArbol): string {
  const partes: string[] = [];
  if (nodo.notas.trim()) partes.push(nodo.notas.trim());
  const hijos = hijosDe(a, nodo.id).map(h => h.texto).filter(Boolean);
  if (hijos.length) partes.push(`Sub-conceptos: ${hijos.join(", ")}`);
  if (nodo.fuentes.length) partes.push(`Fuentes: ${nodo.fuentes.join("; ")}`);
  return partes.join("\n\n") || "(sin notas — repasa la idea en tu cabeza)";
}

export function construirMazo(a: Arbol): Tarjeta[] {
  return a.nodos
    .filter(n => n.texto.trim())
    .map(n => ({ nodoId: n.id, anverso: n.texto, reverso: reversoDe(a, n), ruta: rutaTexto(a, n) }));
}

/** Las tarjetas que toca repasar hoy (nuevas + vencidas), las más frágiles primero. */
export function sesionDeHoy(a: Arbol, progreso: MapaProgreso, hoy: string): TarjetaConProgreso[] {
  return construirMazo(a)
    .map(t => ({ ...t, progreso: progreso[t.nodoId] ?? estadoInicial(hoy) }))
    .filter(t => tocaHoy(t.progreso, hoy))
    .sort((x, y) => x.progreso.caja - y.progreso.caja);
}

/** Cuántas tarjetas tocan hoy (para el badge del botón, sin armar la sesión). */
export function pendientesHoy(a: Arbol, progreso: MapaProgreso, hoy: string): number {
  return sesionDeHoy(a, progreso, hoy).length;
}

// La raíz también es tarjeta: el concepto central merece repaso. Se incluye
// vía construirMazo sin trato especial (esto es solo documentación de intención).
export const incluyeRaiz = (a: Arbol) => Boolean(raizDe(a).texto.trim());
