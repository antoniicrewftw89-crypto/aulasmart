"use client";
// panel-nodo.tsx — Lo que no cabe dentro del nodo: notas, fuentes,
// estado, color y etiquetas del nodo seleccionado.
import type { CambiosNodo } from "@/lib/arbol/modelo";
import type { EstadoNodo, NodoArbol } from "@/lib/arbol/types";
import { useState } from "react";

const PALETA = ["#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];
const ESTADOS: { valor: EstadoNodo; texto: string }[] = [
  { valor: "borrador", texto: "Borrador" },
  { valor: "verificado", texto: "✅ Verificado" },
  { valor: "dudoso", texto: "⚠️ Dudoso" },
];

export function PanelNodo(props: {
  nodo: NodoArbol;
  onCambios: (c: CambiosNodo) => void;
  onEliminar: () => void;
  onCerrar: () => void;
}) {
  const { nodo } = props;
  const [fuenteNueva, setFuenteNueva] = useState("");
  const esRaiz = nodo.padreId === null;

  return (
    <aside className="absolute right-3 top-3 z-10 flex w-72 flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/95 p-4 text-sm shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="truncate font-semibold">{nodo.texto || "(sin texto)"}</h2>
        <button onClick={props.onCerrar} className="text-neutral-500 hover:text-neutral-200">✕</button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Estado (lo decides tú)
        <select value={nodo.estado} onChange={e => props.onCambios({ estado: e.target.value as EstadoNodo })}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100">
          {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Notas
        <textarea value={nodo.notas} onChange={e => props.onCambios({ notas: e.target.value })} rows={4}
          placeholder="Apuntes, dudas, lo que tu cabeza necesite dejar aquí"
          className="resize-none rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-sky-500" />
      </label>

      <div className="flex flex-col gap-1 text-xs text-neutral-400">
        Fuentes
        {nodo.fuentes.map((f, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="flex-1 truncate text-neutral-300">{f}</span>
            <button onClick={() => props.onCambios({ fuentes: nodo.fuentes.filter((_x, j) => j !== i) })}
              className="text-neutral-600 hover:text-red-400">✕</button>
          </div>
        ))}
        <form className="flex gap-1" onSubmit={e => {
          e.preventDefault();
          if (!fuenteNueva.trim()) return;
          props.onCambios({ fuentes: [...nodo.fuentes, fuenteNueva.trim()] });
          setFuenteNueva("");
        }}>
          <input value={fuenteNueva} onChange={e => setFuenteNueva(e.target.value)} placeholder="URL o referencia"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100 outline-none focus:border-sky-500" />
          <button className="rounded-md border border-neutral-700 px-2 hover:bg-neutral-800">＋</button>
        </form>
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Etiquetas (separadas por coma)
        <input
          key={nodo.id /* re-montar al cambiar de nodo */}
          defaultValue={nodo.etiquetas.join(", ")}
          onBlur={e => props.onCambios({ etiquetas: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
          placeholder="parcial, fórmula, repasar"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-sky-500" />
      </label>

      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">Color</span>
        {PALETA.map(c => (
          <button key={c} onClick={() => props.onCambios({ color: nodo.color === c ? null : c })}
            style={{ backgroundColor: c }}
            className={`h-5 w-5 rounded-full ${nodo.color === c ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"}`} />
        ))}
      </div>

      {!esRaiz && (
        <button onClick={props.onEliminar}
          className="mt-1 rounded-md border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950">
          🗑 Eliminar nodo (y sus hijos)
        </button>
      )}
    </aside>
  );
}
