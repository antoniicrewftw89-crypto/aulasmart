// acciones-nodo.ts — La parte PURA de la IA por nodo: prompts, esquema de
// respuesta y cómo se aplica al árbol. La IA solo actúa cuando el humano
// pulsa el botón; aquí no hay llamadas de red.
import { z } from "zod";
import type { Arbol, NodoArbol } from "../arbol/types";
import { editarNodo, hijosDe } from "../arbol/modelo";

export type AccionIA = "verificar" | "investigar";

export const EsquemaRespuestaIA = z.object({
  veredicto: z.enum(["correcto", "impreciso", "incorrecto", "ampliado"]),
  explicacion: z.string(),
  fuentes: z.array(z.string()),
  // null = no cambiar el estado (p. ej. al investigar)
  estadoSugerido: z.enum(["verificado", "dudoso"]).nullable(),
});
export type RespuestaIA = z.infer<typeof EsquemaRespuestaIA>;

/** Ruta desde la raíz hasta el nodo: "Límites > definición > épsilon-delta". */
function rutaTexto(a: Arbol, nodo: NodoArbol): string {
  const porId = new Map(a.nodos.map(n => [n.id, n]));
  const partes: string[] = [];
  let actual: NodoArbol | undefined = nodo;
  while (actual) {
    partes.unshift(actual.texto || "(sin texto)");
    actual = actual.padreId ? porId.get(actual.padreId) : undefined;
  }
  return partes.join(" > ");
}

export function construirPrompt(accion: AccionIA, a: Arbol, nodo: NodoArbol): { system: string; prompt: string } {
  const system = [
    "Eres el asistente de estudio de un estudiante universitario de ingeniería.",
    "Respondes SIEMPRE en español, con rigor y sin relleno.",
    "El árbol de ideas es del estudiante: tú no inventas su estructura, solo evalúas o amplías el punto que te pide.",
    "En 'fuentes' das referencias reales y verificables (URLs o libros conocidos); si no estás seguro de una fuente, no la inventes.",
  ].join(" ");

  const contexto = [
    `Materia: ${a.materia}. Árbol: "${a.titulo}".`,
    `Punto del árbol (ruta): ${rutaTexto(a, nodo)}`,
    nodo.notas.trim() ? `Notas del estudiante sobre este punto: ${nodo.notas.trim()}` : "",
    hijosDe(a, nodo.id).length
      ? `Sub-puntos que ya tiene debajo: ${hijosDe(a, nodo.id).map(h => h.texto).join("; ")}`
      : "",
  ].filter(Boolean).join("\n");

  const tarea = accion === "verificar"
    ? [
        "TAREA: evalúa si la afirmación/idea del punto es correcta tal como la escribió el estudiante.",
        "veredicto: 'correcto', 'impreciso' o 'incorrecto'. explicacion: por qué, breve y concreta, con el matiz exacto si lo hay.",
        "estadoSugerido: 'verificado' solo si es correcto; 'dudoso' si es impreciso o incorrecto.",
      ].join("\n")
    : [
        "TAREA: profundiza este punto para estudiarlo mejor: 3-5 ideas nuevas, un ejemplo concreto y, si aplica, el error típico de examen.",
        "veredicto: 'ampliado'. estadoSugerido: null (no cambies el estado del punto).",
      ].join("\n");

  return { system, prompt: `${contexto}\n\n${tarea}` };
}

export function aplicarRespuesta(a: Arbol, nodoId: string, r: RespuestaIA, fechaIso: string): Arbol {
  const nodo = a.nodos.find(n => n.id === nodoId);
  if (!nodo) return a;
  const bloque = `— IA (${fechaIso.slice(0, 10)}) [${r.veredicto}] —\n${r.explicacion.trim()}`;
  return editarNodo(a, nodoId, {
    notas: nodo.notas.trim() ? `${nodo.notas.trimEnd()}\n\n${bloque}` : bloque,
    fuentes: [...new Set([...nodo.fuentes, ...r.fuentes])],
    estado: r.estadoSugerido ?? nodo.estado,
  });
}
