// conexiones.ts — "Conexiones automáticas": la IA busca relaciones conceptuales
// entre nodos de ramas distintas y las dibuja como flechas. Parte PURA: el
// prompt (cada nodo con un código estable N1, N2…) y cómo se aplican los pares
// propuestos reusando `conectar` (que ya valida: no padre-hijo, no duplicadas).
import { z } from "zod";
import type { Arbol } from "../arbol/types";
import { conectar } from "../arbol/modelo";

export const EsquemaConexiones = z.object({
  pares: z.array(z.object({
    desde: z.string(),   // código de nodo, p. ej. "N3"
    hasta: z.string(),   // código de nodo, p. ej. "N7"
    etiqueta: z.string(),
  })),
});
export type RespuestaConexiones = z.infer<typeof EsquemaConexiones>;

// Código estable por nodo con texto (orden del array = estable mientras no se edite).
function codigosDe(a: Arbol): { codigo: string; id: string; texto: string }[] {
  return a.nodos.filter(n => n.texto.trim()).map((n, i) => ({ codigo: `N${i + 1}`, id: n.id, texto: n.texto }));
}

export function construirPromptConexiones(a: Arbol): { system: string; prompt: string } {
  const system = [
    "Eres el asistente de estudio de un estudiante de ingeniería.",
    "Buscas relaciones CONCEPTUALES entre ideas de su mapa que estén en ramas distintas",
    "(no padre-hijo): cosas que se conectan, se contrastan o dependen una de otra.",
    "Respondes SIEMPRE en español. No fuerces conexiones: solo las que de verdad ayudan a entender.",
  ].join(" ");
  const lista = codigosDe(a).map(c => `${c.codigo}: ${c.texto}`).join("\n");
  const prompt = [
    `Nodos del árbol "${a.titulo}":`,
    lista,
    "",
    "TAREA: devuelve en 'pares' las conexiones conceptuales útiles entre nodos",
    "(usa sus códigos en 'desde' y 'hasta') con una 'etiqueta' corta que diga la",
    "relación (p. ej. 'se usa en', 'caso particular de', 'se contrasta con'). No",
    "conectes un nodo con su propio padre/hijo ni repitas pares.",
  ].join("\n");
  return { system, prompt };
}

/** Aplica los pares propuestos (resueltos por código). PURO: `conectar` valida cada uno. */
export function aplicarConexiones(a: Arbol, pares: RespuestaConexiones["pares"]): Arbol {
  const porCodigo = new Map(codigosDe(a).map(c => [c.codigo.toUpperCase(), c.id]));
  let arbol = a;
  for (const p of pares) {
    const desdeId = porCodigo.get((p.desde ?? "").trim().toUpperCase());
    const hastaId = porCodigo.get((p.hasta ?? "").trim().toUpperCase());
    if (!desdeId || !hastaId) continue;
    arbol = conectar(arbol, desdeId, hastaId, (p.etiqueta ?? "").trim());
  }
  return arbol;
}
