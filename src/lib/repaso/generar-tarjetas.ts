// generar-tarjetas.ts — Construye el mazo de un árbol. PURO (sin red).
// Dos motores: determinista (sin IA, usa la estructura del árbol) y la parte
// pura del motor IA (prompt + esquema + aplicar). La llamada real vive en la API.
import { z } from "zod";
import type { Arbol, NodoArbol } from "../arbol/types";
import { hijosDe } from "../arbol/modelo";
import type { Mazo, TarjetaOpcion, TarjetaVoltear } from "./tipos-tarjeta";

// --- Reverso de una tarjeta "voltear" (notas + sub-conceptos) -------------- #
function reversoDe(a: Arbol, nodo: NodoArbol): string {
  const partes: string[] = [];
  if (nodo.notas.trim()) partes.push(nodo.notas.trim());
  const hijos = hijosDe(a, nodo.id).map(h => h.texto).filter(Boolean);
  if (hijos.length) partes.push(`Sub-conceptos: ${hijos.join(", ")}`);
  return partes.join("\n\n") || "(sin notas — repasa la idea en tu cabeza)";
}

// Hash estable de un id → entero no negativo (para elegir posición de forma
// determinista pero "repartida").
function hashId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// --- Motor DETERMINISTA (sin IA, siempre disponible) ----------------------- #
export function generarMazoDeterminista(a: Arbol): Mazo {
  const conTexto = a.nodos.filter(n => n.texto.trim());
  const mazo: Mazo = [];

  // 1) Una tarjeta "voltear" por nodo con texto
  for (const n of conTexto) {
    const carta: TarjetaVoltear = { nodoId: n.id, tipo: "voltear", anverso: n.texto, reverso: reversoDe(a, n) };
    mazo.push(carta);
  }

  // 2) Opción múltiple: por cada nodo CON NOTAS, si hay ≥4 conceptos distintos
  //    para formar opciones (1 correcta + 3 distractores tomados del árbol).
  const candidatos = conTexto.filter(n => n.notas.trim());
  for (const n of candidatos) {
    const distractores = elegirDistractores(a, n, conTexto);
    if (distractores.length < 3) continue; // no hay material para 4 opciones

    const correctas = [n.texto];
    const opcionesTexto = [...correctas, ...distractores.slice(0, 3)];
    const pos = hashId(n.id) % 4;            // posición de la correcta, repartida
    const opciones = insertarEn(opcionesTexto.slice(1), n.texto, pos);

    const carta: TarjetaOpcion = {
      nodoId: n.id, tipo: "opcion",
      pregunta: `¿Qué concepto corresponde a esta idea?\n\n«${n.notas.trim()}»`,
      opciones, correcta: pos,
      explica: rutaTexto(a, n),
    };
    mazo.push(carta);
  }
  return mazo;
}

// Distractores plausibles: primero hermanos (mismo padre), luego el resto.
function elegirDistractores(a: Arbol, nodo: NodoArbol, conTexto: NodoArbol[]): string[] {
  const otros = conTexto.filter(o => o.id !== nodo.id && o.texto.trim() !== nodo.texto.trim());
  const hermanos = otros.filter(o => o.padreId === nodo.padreId);
  const resto = otros.filter(o => o.padreId !== nodo.padreId);
  const ordenados = [...hermanos, ...resto];
  // únicos por texto, preservando orden
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const o of ordenados) {
    if (!vistos.has(o.texto)) { vistos.add(o.texto); unicos.push(o.texto); }
  }
  return unicos;
}

// Inserta `valor` en la posición `pos` de una lista de 3 → lista de 4.
function insertarEn(tres: string[], valor: string, pos: number): string[] {
  const r = [...tres];
  r.splice(pos, 0, valor);
  return r;
}

function rutaTexto(a: Arbol, nodo: NodoArbol): string {
  const porId = new Map(a.nodos.map(n => [n.id, n]));
  const partes: string[] = [];
  let actual: NodoArbol | undefined = nodo;
  while (actual) { partes.unshift(actual.texto || "(sin texto)"); actual = actual.padreId ? porId.get(actual.padreId) : undefined; }
  return partes.join(" › ");
}

// --- Motor IA (parte PURA: prompt + esquema + aplicar) --------------------- #
export const EsquemaMazoIA = z.object({
  preguntas: z.array(z.object({
    nodoId: z.string(),
    pregunta: z.string(),
    opciones: z.array(z.string()).length(4),
    correcta: z.number().int().min(0).max(3),
    explica: z.string(),
  })),
});
export type RespuestaMazoIA = z.infer<typeof EsquemaMazoIA>;

/** Un SOLO prompt con todo el árbol → la IA devuelve todas las preguntas (1 llamada). */
export function construirPromptMazo(a: Arbol): { system: string; prompt: string } {
  const system = [
    "Eres el profesor particular de un estudiante universitario de ingeniería.",
    "Respondes SIEMPRE en español, con rigor y sin relleno.",
    "Creas preguntas de examen DESDE el árbol del estudiante; no inventas temas fuera de él.",
  ].join(" ");

  const porId = new Map(a.nodos.map(n => [n.id, n]));
  const ruta = (n: NodoArbol) => {
    const p: string[] = []; let cur: NodoArbol | undefined = n;
    while (cur) { p.unshift(cur.texto || "?"); cur = cur.padreId ? porId.get(cur.padreId) : undefined; }
    return p.join(" › ");
  };
  const lista = a.nodos
    .filter(n => n.texto.trim())
    .map(n => `- id=${n.id} | ${ruta(n)}${n.notas.trim() ? ` | notas: ${n.notas.trim()}` : ""}`)
    .join("\n");

  const prompt = [
    `Materia: ${a.materia}. Árbol: "${a.titulo}".`,
    "Nodos del árbol:",
    lista,
    "",
    "TAREA: por cada nodo que tenga contenido suficiente, crea UNA pregunta de",
    "OPCIÓN MÚLTIPLE con 4 opciones (una correcta y tres distractores plausibles,",
    "preferiblemente errores típicos de examen sobre ese tema). Devuelve el nodoId",
    "de cada pregunta para poder mapearla, el índice 'correcta' (0..3) y una",
    "explicación breve de por qué es la correcta. No repitas opciones dentro de una pregunta.",
  ].join("\n");

  return { system, prompt };
}

/** Convierte la respuesta de la IA en tarjetas válidas (descarta nodos inexistentes o mal formadas). */
export function aplicarMazoIA(a: Arbol, respuesta: RespuestaMazoIA): Mazo {
  const ids = new Set(a.nodos.map(n => n.id));
  const mazo: Mazo = [];
  for (const p of respuesta.preguntas) {
    if (!ids.has(p.nodoId)) continue;
    if (p.opciones.length !== 4) continue;
    if (!(Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < 4)) continue;
    if (new Set(p.opciones).size !== 4) continue;
    mazo.push({
      nodoId: p.nodoId, tipo: "opcion",
      pregunta: p.pregunta, opciones: p.opciones, correcta: p.correcta, explica: p.explica,
    });
  }
  return mazo;
}
