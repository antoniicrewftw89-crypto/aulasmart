// huecos.ts — "Completar huecos": la IA mira TU árbol y propone los conceptos
// que faltan para un temario completo. La parte PURA: el prompt, y cómo se
// aplican los huecos al árbol (descartando lo que ya existe). La IA solo propone;
// los nodos nuevos nacen en "borrador" para que el humano los apruebe.
import type { Arbol } from "../arbol/types";
import { hijosDe, raizDe } from "../arbol/modelo";
import { aplicarOutline, type NodoOutline, type Outline } from "../ingesta/esquema";

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

/** El árbol actual como lista jerárquica de texto (para dárselo a la IA). */
function outlineTexto(a: Arbol): string {
  const render = (id: string, nivel: number): string[] =>
    hijosDe(a, id).flatMap(n => [
      `${"  ".repeat(nivel)}- ${n.texto || "(sin texto)"}`,
      ...render(n.id, nivel + 1),
    ]);
  const raiz = raizDe(a);
  return [`# ${raiz.texto || a.titulo}`, ...render(raiz.id, 0)].join("\n");
}

export function construirPromptHuecos(a: Arbol): { system: string; prompt: string } {
  const system = [
    "Eres el profesor particular de un estudiante de ingeniería.",
    "Miras su árbol de estudio y propones SOLO los conceptos que faltan para que el temario quede completo.",
    "Respondes SIEMPRE en español. No repitas lo que ya está. No inventes relleno: solo huecos reales y útiles.",
  ].join(" ");
  const prompt = [
    `Materia: ${a.materia}. Árbol actual sobre "${a.titulo}":`,
    "",
    outlineTexto(a),
    "",
    "TAREA: propón en 'ramas' los conceptos/subpuntos que FALTAN para un temario",
    "completo de este tema (hasta 3 niveles). Cada nodo: 'texto' = el concepto en",
    "pocas palabras y, si aporta, 'notas' = una idea de apoyo. NO incluyas nada que",
    "ya esté en el árbol de arriba. 'titulo' puedes repetir el del árbol.",
  ].join("\n");
  return { system, prompt };
}

/** Quita del outline propuesto los conceptos que YA existen en el árbol (por texto). */
export function filtrarHuecos(a: Arbol, ramas: NodoOutline[]): NodoOutline[] {
  const existentes = new Set(a.nodos.map(n => norm(n.texto)).filter(Boolean));
  const limpiar = (nodos: NodoOutline[]): NodoOutline[] =>
    nodos
      .filter(n => (n.texto ?? "").trim() && !existentes.has(norm(n.texto)))
      .map(n => ({ texto: n.texto, notas: n.notas, hijos: n.hijos ? limpiar(n.hijos) : undefined }));
  return limpiar(ramas);
}

/** Aplica los huecos NUEVOS bajo la raíz (en "borrador"). PURO. */
export function aplicarHuecos(a: Arbol, outline: Outline): Arbol {
  const nuevas = filtrarHuecos(a, outline.ramas);
  return aplicarOutline(a, raizDe(a).id, nuevas);
}
