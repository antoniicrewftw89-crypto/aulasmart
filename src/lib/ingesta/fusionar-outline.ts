// fusionar-outline.ts — Une los outlines parciales de cada trozo en uno solo.
// PURO y determinista: ramas con el mismo título (normalizado) funden sus hijos
// recursivamente, así un documento troceado no produce ramas duplicadas.
import type { NodoOutline, Outline } from "./esquema";

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

function fundirNodos(nodos: NodoOutline[]): NodoOutline[] {
  const orden: string[] = [];
  const por = new Map<string, NodoOutline>();
  for (const n of nodos) {
    const texto = (n.texto ?? "").trim();
    const k = norm(texto);
    if (!k) continue;
    const ex = por.get(k);
    if (!ex) {
      por.set(k, { texto, notas: n.notas?.trim() || undefined, hijos: n.hijos ? [...n.hijos] : [] });
      orden.push(k);
    } else {
      if (!ex.notas && n.notas?.trim()) ex.notas = n.notas.trim();
      if (n.hijos?.length) ex.hijos = [...(ex.hijos ?? []), ...n.hijos];
    }
  }
  return orden.map(k => {
    const nodo = por.get(k)!;
    const hijos = nodo.hijos?.length ? fundirNodos(nodo.hijos) : undefined;
    return { texto: nodo.texto, notas: nodo.notas, hijos };
  });
}

export function fusionarOutlines(outlines: Outline[]): Outline {
  const titulo = outlines.map(o => (o.titulo ?? "").trim()).find(Boolean) ?? "Sin título";
  const ramas = fundirNodos(outlines.flatMap(o => o.ramas ?? []));
  return { titulo, ramas };
}
