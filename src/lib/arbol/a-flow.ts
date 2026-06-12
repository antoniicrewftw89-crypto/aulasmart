// a-flow.ts — Proyección del Árbol al formato de React Flow + auto-layout.
// dagre decide posiciones SOLO para nodos sin posicion manual.
import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { Arbol, NodoArbol } from "./types";

export type DatosNodoIdea = { nodo: NodoArbol };

const ANCHO = (n: NodoArbol) => Math.min(280, Math.max(140, 60 + n.texto.length * 7));
const ALTO = 52;

export function aFlow(a: Arbol): { nodes: Node<DatosNodoIdea>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of a.nodos) g.setNode(n.id, { width: ANCHO(n), height: ALTO });
  for (const n of a.nodos) if (n.padreId) g.setEdge(n.padreId, n.id);
  dagre.layout(g);

  const nodes: Node<DatosNodoIdea>[] = a.nodos.map(n => ({
    id: n.id,
    type: "idea",
    position: n.posicion ?? { x: g.node(n.id).x - ANCHO(n) / 2, y: g.node(n.id).y - ALTO / 2 },
    data: { nodo: n },
  }));

  const edges: Edge[] = [
    ...a.nodos.filter(n => n.padreId).map(n => ({
      id: `j-${n.id}`, source: n.padreId!, target: n.id, type: "smoothstep" as const,
    })),
    ...a.relaciones.map(r => ({
      id: `r-${r.id}`, source: r.desdeId, target: r.hastaId, label: r.etiqueta || undefined,
      animated: true, style: { strokeDasharray: "6 4" },
    })),
  ];
  return { nodes, edges };
}
