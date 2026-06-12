// guion.ts — Del árbol al guion de estudio. Determinista y PURO: recorre
// TU árbol y lo ordena como documento; no inventa contenido (eso es F1,
// nodo a nodo y a petición).
import type { Arbol, NodoArbol } from "../arbol/types";
import { hijosDe, raizDe } from "../arbol/modelo";

const MARCA = { borrador: "", verificado: "✅ ", dudoso: "⚠️ " } as const;

function seccion(a: Arbol, nodo: NodoArbol, nivel: number): string[] {
  const sangria = "  ".repeat(nivel);
  const out = [`${sangria}- ${MARCA[nodo.estado]}${nodo.texto || "(sin texto)"}`];
  if (nodo.notas.trim()) {
    for (const linea of nodo.notas.trim().split(/\r?\n/)) out.push(`${sangria}  ${linea}`.trimEnd());
  }
  for (const h of hijosDe(a, nodo.id)) out.push(...seccion(a, h, nivel + 1));
  return out;
}

export function generarGuionMd(a: Arbol): string {
  const raiz = raizDe(a);
  const ramas = hijosDe(a, raiz.id);
  const fecha = new Date().toISOString().slice(0, 10);

  const cuerpo = ramas.flatMap((rama, i) => [
    "",
    `## ${i + 1}. ${MARCA[rama.estado]}${rama.texto || "(sin texto)"}`,
    "",
    ...(rama.notas.trim() ? [rama.notas.trim(), ""] : []),
    ...hijosDe(a, rama.id).flatMap(h => seccion(a, h, 0)),
  ]);

  const dudosos = a.nodos.filter(n => n.estado === "dudoso");
  const checklist = dudosos.length
    ? ["", "## Checklist de repaso", "", ...dudosos.map(n => `- [ ] ${n.texto || "(sin texto)"}`)]
    : [];

  const fuentes = a.nodos.flatMap(n => n.fuentes.map(f => `- ${f} (${n.texto || "raíz"})`));
  const seccionFuentes = fuentes.length ? ["", "## Fuentes", "", ...fuentes] : [];

  return [
    "---",
    `titulo: Guion de estudio — ${a.titulo}`,
    `fecha: ${fecha}`,
    "proyecto: aulasmart",
    `tags: [estudio, ${a.materia}, guion]`,
    "origen: aulasmart",
    "---",
    "",
    `# Guion de estudio — ${a.titulo}`,
    "",
    `> Generado desde tu árbol (${a.nodos.length} nodos) el ${fecha}. La fuente de verdad es \`data/arboles/${a.materia}/${a.tema}.json\`.`,
    ...cuerpo,
    ...checklist,
    ...seccionFuentes,
    "",
  ].join("\n");
}
