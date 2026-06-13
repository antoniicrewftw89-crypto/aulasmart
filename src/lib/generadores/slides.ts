// slides.ts — Del árbol a una presentación Marp. Determinista y PURO: una slide
// por rama principal, sus subnodos como viñetas. No inventa contenido (igual que
// el guion); es TU árbol reordenado para proyectar/estudiar.
// El .md resultante se abre con Marp (VS Code "Marp for VS Code" o `marp`).
import type { Arbol, NodoArbol } from "../arbol/types";
import { hijosDe, raizDe } from "../arbol/modelo";

const MARCA = { borrador: "", verificado: "✅ ", dudoso: "⚠️ " } as const;

// Un nodo y sus descendientes como lista anidada (cuerpo de una slide). La
// primera línea de notas va como apoyo en cursiva, para no saturar la slide.
function vinetas(a: Arbol, nodo: NodoArbol, nivel: number): string[] {
  const sangria = "  ".repeat(nivel);
  const out = [`${sangria}- ${MARCA[nodo.estado]}${nodo.texto || "(sin texto)"}`];
  if (nodo.notas.trim()) {
    out.push(`${sangria}  - *${nodo.notas.trim().split(/\r?\n/)[0]}*`);
  }
  for (const h of hijosDe(a, nodo.id)) out.push(...vinetas(a, h, nivel + 1));
  return out;
}

const slide = (lineas: string[]): string => lineas.join("\n");

export function generarSlidesMd(a: Arbol): string {
  const raiz = raizDe(a);
  const ramas = hijosDe(a, raiz.id);
  const fecha = new Date().toISOString().slice(0, 10);

  const portada = slide([
    `# ${a.titulo || "(sin título)"}`,
    "",
    `### ${a.materia}`,
    "",
    `Generado desde tu árbol · ${a.nodos.length} nodos · ${fecha}`,
  ]);

  const indice = ramas.length
    ? slide(["## Índice", "", ...ramas.map((r, i) => `${i + 1}. ${r.texto || "(sin texto)"}`)])
    : "";

  const cuerpo = ramas.map((rama, i) => slide([
    `## ${i + 1}. ${MARCA[rama.estado]}${rama.texto || "(sin texto)"}`,
    "",
    ...(rama.notas.trim() ? [`> ${rama.notas.trim().split(/\r?\n/)[0]}`, ""] : []),
    ...hijosDe(a, rama.id).flatMap(h => vinetas(a, h, 0)),
  ]));

  const dudosos = a.nodos.filter(n => n.estado === "dudoso");
  const repaso = dudosos.length
    ? slide(["## ⚠️ Repasar / verificar", "", ...dudosos.map(n => `- ${n.texto || "(sin texto)"}`)])
    : "";

  const fuentes = Array.from(new Set(a.nodos.flatMap(n => n.fuentes.map(f => `- ${f}`))));
  const slideFuentes = fuentes.length ? slide(["## Fuentes", "", ...fuentes]) : "";

  const cierre = slide(["<!-- _class: lead -->", "", "# ¡A estudiar! 🌱", "", `*${a.titulo || a.materia}*`]);

  const slides = [portada, indice, ...cuerpo, repaso, slideFuentes, cierre].filter(Boolean);

  const frontmatter = [
    "---",
    "marp: true",
    "theme: default",
    "paginate: true",
    `titulo: Slides — ${a.titulo}`,
    `fecha: ${fecha}`,
    "proyecto: aulasmart",
    `tags: [estudio, ${a.materia}, slides]`,
    "origen: aulasmart",
    "---",
  ].join("\n");

  return [frontmatter, "", slides.join("\n\n---\n\n"), ""].join("\n");
}
