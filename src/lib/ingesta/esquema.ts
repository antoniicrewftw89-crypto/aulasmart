// esquema.ts — De material a borrador de árbol. La parte PURA de F5: el esquema
// que la IA rellena, el prompt, y cómo el outline resultante se vuelve un Árbol
// (reusando las mismas mutaciones puras del modelo). La llamada real a la IA
// vive en la API. La IA jamás guarda nada por su cuenta: propone, el humano aprueba.
import { z } from "zod";
import type { Arbol } from "../arbol/types";
import { agregarHijo, crearArbol, editarNodo, raizDe } from "../arbol/modelo";

// Esquema de 3 niveles FIJOS (sin recursión z.lazy): mejor para salida
// estructurada de los modelos y acota la profundidad del árbol propuesto.
const hoja = z.object({
  texto: z.string(),
  notas: z.string().optional(),
});
const rama2 = z.object({
  texto: z.string(),
  notas: z.string().optional(),
  hijos: z.array(hoja).optional(),
});
const rama1 = z.object({
  texto: z.string(),
  notas: z.string().optional(),
  hijos: z.array(rama2).optional(),
});

export const EsquemaIngesta = z.object({
  titulo: z.string(),
  ramas: z.array(rama1),
});
export type RespuestaIngesta = z.infer<typeof EsquemaIngesta>;

// Forma genérica para recorrer los 3 niveles con una sola función.
interface OutlineNodo {
  texto: string;
  notas?: string;
  hijos?: OutlineNodo[];
}

export function construirPromptIngesta(material: string): { system: string; prompt: string } {
  const system = [
    "Eres el profesor particular de un estudiante de ingeniería.",
    "Conviertes el material que te dan EN un árbol de estudio (mapa mental): un título, ramas principales y subpuntos.",
    "Respondes SIEMPRE en español. NO inventes nada que no esté en el material; si algo no está, no lo pongas.",
  ].join(" ");
  const prompt = [
    "A partir del siguiente material, propón un árbol de estudio:",
    "- un 'titulo' corto para el tema,",
    "- 'ramas' con los conceptos principales, cada una con 'hijos' (subpuntos) hasta 3 niveles,",
    "- cada nodo: 'texto' = el concepto en pocas palabras y, si aporta, 'notas' = una idea de apoyo (1-2 frases).",
    "No repitas conceptos. Mantén el árbol claro y jerárquico, como un buen resumen para estudiar.",
    "",
    "MATERIAL:",
    material,
  ].join("\n");
  return { system, prompt };
}

/** Injerta `ramas` (un outline) bajo `padreId`. PURO: devuelve un Árbol nuevo. */
export function aplicarOutline(arbol: Arbol, padreId: string, ramas: OutlineNodo[]): Arbol {
  let a = arbol;
  const insertar = (pid: string, nodos: OutlineNodo[]) => {
    for (const n of nodos) {
      const texto = (n.texto ?? "").trim();
      if (!texto) {
        // Nodo sin concepto: se salta, pero sus hijos se reenganchan al padre.
        if (n.hijos?.length) insertar(pid, n.hijos);
        continue;
      }
      const { arbol: a2, nodo } = agregarHijo(a, pid, texto);
      a = a2;
      if (n.notas?.trim()) a = editarNodo(a, nodo.id, { notas: n.notas.trim() });
      if (n.hijos?.length) insertar(nodo.id, n.hijos);
    }
  };
  insertar(padreId, ramas);
  return a;
}

/** Árbol NUEVO desde la respuesta de la IA (raíz = título). PURO. */
export function construirArbolIngesta(materia: string, tema: string, resp: RespuestaIngesta): Arbol {
  const base = crearArbol(materia, tema, (resp.titulo ?? "").trim() || "Sin título");
  return aplicarOutline(base, raizDe(base).id, resp.ramas);
}
