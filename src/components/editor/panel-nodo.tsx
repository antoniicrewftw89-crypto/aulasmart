"use client";
// panel-nodo.tsx — La trastienda del sticky seleccionado: notas, fuentes,
// estado y etiquetas. El color se pinta desde la caja de herramientas y
// la IA vive en su propio cajón (✨): aquí solo está LO TUYO.
import type { CambiosNodo } from "@/lib/arbol/modelo";
import type { EstadoNodo, NodoArbol } from "@/lib/arbol/types";
import { useState } from "react";

const ESTADOS: { valor: EstadoNodo; texto: string }[] = [
  { valor: "borrador", texto: "Borrador" },
  { valor: "verificado", texto: "✓ Verificado" },
  { valor: "dudoso", texto: "! Dudoso" },
];

const campo = "rounded-lg border border-[var(--linea)] bg-white px-2.5 py-1.5 text-sm text-[var(--tinta)] outline-none focus:border-[var(--acento)]";

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
    <aside className="sombra-caja absolute right-4 top-4 z-10 flex w-72 flex-col gap-3 rounded-2xl border border-[var(--linea)] bg-[#fffdf8] p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="manuscrita truncate text-2xl text-[var(--tinta)]">{nodo.texto || "(sin texto)"}</h2>
        <button onClick={props.onCerrar} className="text-[var(--tinta-suave)] hover:text-[var(--tinta)]">✕</button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-[var(--tinta-suave)]">
        Estado (lo decides tú)
        <select value={nodo.estado} onChange={e => props.onCambios({ estado: e.target.value as EstadoNodo })} className={campo}>
          {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-[var(--tinta-suave)]">
        Notas
        <textarea value={nodo.notas} onChange={e => props.onCambios({ notas: e.target.value })} rows={5}
          placeholder="Apuntes, dudas, lo que tu cabeza necesite soltar aquí"
          className={`${campo} resize-none placeholder:text-[var(--tinta-suave)]`} />
      </label>

      <div className="flex flex-col gap-1 text-xs text-[var(--tinta-suave)]">
        Fuentes
        {nodo.fuentes.map((f, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="flex-1 truncate text-[var(--tinta)]">{f}</span>
            <button onClick={() => props.onCambios({ fuentes: nodo.fuentes.filter((_x, j) => j !== i) })}
              className="text-[var(--tinta-suave)] hover:text-red-600">✕</button>
          </div>
        ))}
        <form className="flex gap-1" onSubmit={e => {
          e.preventDefault();
          if (!fuenteNueva.trim()) return;
          props.onCambios({ fuentes: [...nodo.fuentes, fuenteNueva.trim()] });
          setFuenteNueva("");
        }}>
          <input value={fuenteNueva} onChange={e => setFuenteNueva(e.target.value)} placeholder="URL o referencia"
            className={`${campo} flex-1`} />
          <button className="rounded-lg border border-[var(--linea)] px-2.5 hover:bg-[var(--papel-sombra)]">＋</button>
        </form>
      </div>

      <label className="flex flex-col gap-1 text-xs text-[var(--tinta-suave)]">
        Etiquetas (separadas por coma)
        <input
          key={nodo.id /* re-montar al cambiar de sticky */}
          defaultValue={nodo.etiquetas.join(", ")}
          onBlur={e => props.onCambios({ etiquetas: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
          placeholder="parcial, fórmula, repasar"
          className={campo} />
      </label>

      {!esRaiz && (
        <button onClick={props.onEliminar}
          className="mt-1 rounded-xl border border-red-200 px-3 py-1.5 text-red-600 transition hover:bg-red-50">
          🗑 Quitar sticky (y sus hijos)
        </button>
      )}
    </aside>
  );
}
