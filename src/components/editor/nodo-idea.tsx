"use client";
// nodo-idea.tsx — El nodo del mindmap: edición inline (doble click),
// borde según estado, color de la paleta y chips de etiquetas.
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { NodoArbol } from "@/lib/arbol/types";

export type NodoIdeaFlow = Node<{
  nodo: NodoArbol;
  editando: boolean;
  resaltado: boolean;
  onTexto: (id: string, texto: string) => void;
  onEditar: (id: string | null) => void;
}, "idea">;

const BORDE_ESTADO = {
  borrador: "border-neutral-600",
  verificado: "border-emerald-500",
  dudoso: "border-amber-500",
} as const;

export function NodoIdea({ id, data, selected }: NodeProps<NodoIdeaFlow>) {
  const { nodo, editando, resaltado } = data;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editando) { input.current?.focus(); input.current?.select(); } }, [editando]);

  return (
    <div
      onDoubleClick={e => { e.stopPropagation(); data.onEditar(id); }}
      style={nodo.color ? { backgroundColor: `${nodo.color}22`, borderColor: nodo.color } : undefined}
      className={`rounded-lg border-2 bg-neutral-900 px-3 py-2 shadow-md transition-shadow
        ${BORDE_ESTADO[nodo.estado]} ${selected ? "ring-2 ring-sky-400" : ""} ${resaltado ? "ring-2 ring-yellow-300" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-neutral-500" />
      {editando ? (
        <input
          ref={input}
          defaultValue={nodo.texto}
          onBlur={e => { data.onTexto(id, e.target.value); data.onEditar(null); }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
            e.stopPropagation(); // que Tab/Enter del canvas no creen nodos mientras escribo
          }}
          className="nodrag w-40 bg-transparent text-sm text-neutral-100 outline-none"
        />
      ) : (
        <p className="max-w-56 truncate text-sm text-neutral-100">
          {nodo.estado === "verificado" && "✅ "}{nodo.estado === "dudoso" && "⚠️ "}
          {nodo.texto || <span className="text-neutral-500">(doble click para escribir)</span>}
        </p>
      )}
      {nodo.etiquetas.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {nodo.etiquetas.map(t => (
            <span key={t} className="rounded bg-neutral-800 px-1.5 text-[10px] text-neutral-400">{t}</span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-neutral-500" />
    </div>
  );
}
