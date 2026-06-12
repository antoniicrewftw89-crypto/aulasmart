"use client";
// nodo-idea.tsx — El sticky del mindmap: papel de color con rotación sutil,
// texto en tinta, edición inline (doble click). El estado vive en una
// esquinita (✓ verde / ! ámbar), no gritando en el borde.
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

const COLOR_DEFECTO = "#ffe48a"; // amarillo post-it: el sticky de toda la vida

// Rotación determinista por id (-2.4º..2.4º): cada sticky cae "a su manera"
function rotacionDe(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.8;
}

export function NodoIdea({ id, data, selected }: NodeProps<NodoIdeaFlow>) {
  const { nodo, editando, resaltado } = data;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editando) { input.current?.focus(); input.current?.select(); } }, [editando]);

  const esRaiz = nodo.padreId === null;
  const fondo = nodo.color ?? (esRaiz ? "#fffdf8" : COLOR_DEFECTO);

  return (
    <div
      onDoubleClick={e => { e.stopPropagation(); data.onEditar(id); }}
      style={{
        backgroundColor: fondo,
        transform: `rotate(${selected || editando ? 0 : rotacionDe(id)}deg)`,
      }}
      className={`sombra-sticky rounded-sm px-3.5 py-2.5 transition-transform duration-150
        ${esRaiz ? "rounded-xl border-2 border-[var(--tinta)] px-5 py-3" : ""}
        ${selected ? "outline-2 outline-offset-2 outline-[var(--acento)]" : ""}
        ${resaltado ? "outline-2 outline-offset-2 outline-amber-500" : ""}`}
    >
      <Handle type="target" position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--papel)] !bg-[var(--tinta-suave)]" />

      {/* Estado en la esquina, como una pegatinita */}
      {nodo.estado !== "borrador" && (
        <span className={`absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white sombra-sticky
          ${nodo.estado === "verificado" ? "bg-[var(--acento)]" : "bg-amber-500"}`}>
          {nodo.estado === "verificado" ? "✓" : "!"}
        </span>
      )}

      {editando ? (
        <input
          ref={input}
          defaultValue={nodo.texto}
          onBlur={e => { data.onTexto(id, e.target.value); data.onEditar(null); }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
            e.stopPropagation(); // que Tab/Enter del lienzo no creen stickies mientras escribo
          }}
          placeholder="escribe tu idea…"
          className="nodrag w-44 bg-transparent text-[15px] font-medium text-[var(--tinta)] outline-none placeholder:text-[var(--tinta-suave)]"
        />
      ) : (
        <p className={`max-w-60 text-[15px] font-medium leading-snug text-[var(--tinta)] ${esRaiz ? "manuscrita text-2xl" : ""}`}>
          {nodo.texto || <span className="manuscrita text-lg text-[var(--tinta-suave)]">doble click…</span>}
        </p>
      )}

      {nodo.etiquetas.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {nodo.etiquetas.map(t => (
            <span key={t} className="rounded-full bg-[rgba(56,52,44,0.10)] px-2 text-[10px] font-semibold text-[var(--tinta)]">{t}</span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--papel)] !bg-[var(--tinta-suave)]" />
    </div>
  );
}
