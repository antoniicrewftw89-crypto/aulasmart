// markdown.ts — Árbol → outline .md para la bóveda Obsidian. Función PURA.
import type { Arbol, NodoArbol } from "../arbol/types";
import { hijosDe, raizDe } from "../arbol/modelo";

const ICONO = { borrador: "", verificado: "✅ ", dudoso: "⚠️ " } as const;

function lineas(a: Arbol, nodo: NodoArbol, nivel: number): string[] {
  const sangria = "  ".repeat(nivel);
  const out = [`${sangria}- ${ICONO[nodo.estado]}${nodo.texto || "(sin texto)"}`];
  if (nodo.notas.trim()) out.push(`${sangria}  - _notas:_ ${nodo.notas.trim().replace(/\r?\n/g, " ")}`);
  for (const f of nodo.fuentes) out.push(`${sangria}  - _fuente:_ ${f}`);
  for (const hijo of hijosDe(a, nodo.id)) out.push(...lineas(a, hijo, nivel + 1));
  return out;
}

export function generarOutlineMd(a: Arbol): string {
  const fecha = a.actualizadoEn.slice(0, 10);
  const cuerpo = lineas(a, raizDe(a), 0).join("\n");
  const relaciones = a.relaciones.map(r => {
    const de = a.nodos.find(n => n.id === r.desdeId)?.texto ?? "?";
    const hasta = a.nodos.find(n => n.id === r.hastaId)?.texto ?? "?";
    return `- ${de} → ${hasta}${r.etiqueta ? ` (${r.etiqueta})` : ""}`;
  });
  return [
    "---",
    `titulo: ${a.titulo}`,
    `fecha: ${fecha}`,
    "proyecto: aulasmart",
    `tags: [estudio, ${a.materia}]`,
    "origen: aulasmart",
    "---",
    "",
    `# ${a.titulo}`,
    "",
    `> Archivo autogenerado por AulaSmart. No editar a mano: la fuente de verdad es \`data/arboles/${a.materia}/${a.tema}.json\`.`,
    "",
    cuerpo,
    ...(relaciones.length ? ["", "## Relaciones", "", ...relaciones] : []),
    "",
  ].join("\n");
}
