"use client";
// editor-arbol.tsx — El lienzo Miro-like: pan/zoom, minimapa, teclado
// (Tab hijo · Enter hermano · Supr borrar · F2/doble-click editar),
// drag de posiciones y conexiones cruzadas arrastrando entre handles.
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Background, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  type Connection, type Edge, type Node, type NodeChange, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { aFlow } from "@/lib/arbol/a-flow";
import { raizDe } from "@/lib/arbol/modelo";
import { useArbolEditor } from "./use-arbol-editor";
import { NodoIdea, type NodoIdeaFlow } from "./nodo-idea";
import { PanelNodo } from "./panel-nodo";
import { BarraSuperior } from "./barra-superior";

const tiposDeNodo = { idea: NodoIdea };

function Lienzo({ materia, tema }: { materia: string; tema: string }) {
  const ed = useArbolEditor(materia, tema);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // Posiciones "en vivo" durante el drag (antes de commitear al árbol)
  const [posDrag, setPosDrag] = useState<Record<string, { x: number; y: number }>>({});
  const flow = useReactFlow();

  const onTexto = useCallback((id: string, texto: string) => ed.editarNodo(id, { texto }), [ed]);
  const onEditar = useCallback((id: string | null) => setEditando(id), []);

  const { nodes, edges } = useMemo(() => {
    if (!ed.arbol) return { nodes: [] as Node[], edges: [] as Edge[] };
    const q = busqueda.trim().toLowerCase();
    const proy = aFlow(ed.arbol);
    return {
      edges: proy.edges,
      nodes: proy.nodes.map(n => ({
        ...n,
        position: posDrag[n.id] ?? n.position,
        selected: n.id === seleccion,
        data: {
          ...n.data,
          editando: n.id === editando,
          resaltado: q.length > 1 && n.data.nodo.texto.toLowerCase().includes(q),
          onTexto, onEditar,
        },
      }) as NodoIdeaFlow),
    };
  }, [ed.arbol, seleccion, editando, busqueda, posDrag, onTexto, onEditar]);

  const onNodesChange = useCallback((cambios: NodeChange[]) => {
    for (const c of cambios) {
      if (c.type === "position" && c.position) {
        if (c.dragging) {
          const pos = c.position;
          setPosDrag(p => ({ ...p, [c.id]: pos }));
        } else {
          ed.editarNodo(c.id, { posicion: c.position });
          setPosDrag(p => { const resto = { ...p }; delete resto[c.id]; return resto; });
        }
      }
      if (c.type === "select") setSeleccion(s => (c.selected ? c.id : s === c.id ? null : s));
    }
  }, [ed]);

  const crearHijo = useCallback((padreId: string) => {
    const id = ed.agregarHijo(padreId);
    if (id) { setSeleccion(id); setEditando(id); }
  }, [ed]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return; // escribir nunca dispara atajos
    if (!ed.arbol) return;
    const sel = seleccion ?? raizDe(ed.arbol).id;
    if (e.key === "Tab") { e.preventDefault(); crearHijo(sel); }
    if (e.key === "Enter") {
      e.preventDefault();
      const id = ed.agregarHermano(sel);
      if (id) { setSeleccion(id); setEditando(id); }
    }
    if (e.key === "F2") { e.preventDefault(); setEditando(sel); }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (seleccion) { ed.eliminarNodo(seleccion); setSeleccion(null); }
    }
  }, [ed, seleccion, crearHijo]);

  const irAlPrimero = useCallback(() => {
    const q = busqueda.trim().toLowerCase();
    const n = ed.arbol?.nodos.find(x => x.texto.toLowerCase().includes(q));
    if (!n) return;
    const enCanvas = nodes.find(x => x.id === n.id);
    if (enCanvas) flow.setCenter(enCanvas.position.x, enCanvas.position.y, { zoom: 1.2, duration: 400 });
  }, [busqueda, ed.arbol, nodes, flow]);

  if (ed.noEncontrado) {
    return (
      <main className="grid h-dvh place-items-center text-neutral-400">
        <p>Este árbol no existe. <Link href="/" className="text-emerald-400 underline">Volver al inicio</Link></p>
      </main>
    );
  }
  if (!ed.arbol) return <main className="grid h-dvh place-items-center text-neutral-500">Cargando árbol…</main>;

  const nodoSel = seleccion ? ed.arbol.nodos.find(n => n.id === seleccion) ?? null : null;

  // La IA solo actúa cuando el humano pulsa el botón. Devuelve mensaje de error o null.
  const accionIA = async (nodoId: string, accion: "verificar" | "investigar", proveedor: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/arboles/${materia}/${tema}/nodos/${nodoId}/${accion}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor }),
      });
      const data = await res.json();
      if (!res.ok) return data.error ?? "la IA no pudo responder";
      ed.reemplazarArbol(data.arbol);
      return null;
    } catch { return "sin conexión con el servidor"; }
  };

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} className="flex h-dvh flex-col outline-none">
      <BarraSuperior
        arbol={ed.arbol} guardado={ed.guardado} busqueda={busqueda}
        onBusqueda={setBusqueda} onBuscar={irAlPrimero} onReordenar={ed.reordenar}
        onGenerarGuion={async () => {
          try {
            const res = await fetch(`/api/arboles/${materia}/${tema}/generar/guion`, { method: "POST" });
            const data = await res.json();
            return res.ok ? null : (data.error ?? "no se pudo generar");
          } catch { return "sin conexión con el servidor"; }
        }}
      />
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={tiposDeNodo}
          onNodesChange={onNodesChange}
          onConnect={(c: Connection) => { if (c.source && c.target) ed.conectar(c.source, c.target); }}
          onEdgeDoubleClick={(_e, edge) => { if (edge.id.startsWith("r-")) ed.desconectar(edge.id.slice(2)); }}
          onDoubleClick={() => { if (ed.arbol) crearHijo(seleccion ?? raizDe(ed.arbol).id); }}
          onPaneClick={() => { setSeleccion(null); setEditando(null); }}
          fitView zoomOnDoubleClick={false} deleteKeyCode={null}
          className="bg-neutral-950"
        >
          <Background gap={24} color="#262626" />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable className="!bg-neutral-900" />
        </ReactFlow>
        {nodoSel && (
          <PanelNodo
            nodo={nodoSel}
            onCambios={c => ed.editarNodo(nodoSel.id, c)}
            onEliminar={() => { ed.eliminarNodo(nodoSel.id); setSeleccion(null); }}
            onCerrar={() => setSeleccion(null)}
            onAccionIA={(accion, proveedor) => accionIA(nodoSel.id, accion, proveedor)}
          />
        )}
      </div>
    </div>
  );
}

export function EditorArbol(props: { materia: string; tema: string }) {
  return (
    <ReactFlowProvider>
      <Lienzo {...props} />
    </ReactFlowProvider>
  );
}
