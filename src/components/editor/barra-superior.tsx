"use client";
// barra-superior.tsx — título, búsqueda en canvas, Generar guion,
// Reordenar e indicador de guardado.
import Link from "next/link";
import { useState } from "react";
import type { Arbol } from "@/lib/arbol/types";
import type { EstadoGuardado } from "./use-arbol-editor";

const TEXTO_GUARDADO: Record<EstadoGuardado, [string, string]> = {
  guardado: ["Guardado ✓", "text-emerald-400"],
  guardando: ["Guardando…", "text-neutral-400"],
  pendiente: ["Cambios sin guardar", "text-amber-400"],
  error: ["⚠ Error al guardar — se reintenta al próximo cambio", "text-red-400"],
};

export function BarraSuperior(props: {
  arbol: Arbol; guardado: EstadoGuardado; busqueda: string;
  onBusqueda: (q: string) => void; onBuscar: () => void; onReordenar: () => void;
  onGenerarGuion: () => Promise<string | null>;
}) {
  const [texto, color] = TEXTO_GUARDADO[props.guardado];
  const [generando, setGenerando] = useState(false);
  const [msgGuion, setMsgGuion] = useState("");

  async function generar() {
    setGenerando(true); setMsgGuion("");
    const error = await props.onGenerarGuion();
    setGenerando(false);
    setMsgGuion(error ? `⚠ ${error}` : "📜 Guion guardado (data/ y bóveda)");
    setTimeout(() => setMsgGuion(""), 4000);
  }
  return (
    <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
      <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">← Inicio</Link>
      <h1 className="truncate text-sm font-semibold">
        {props.arbol.titulo} <span className="font-normal text-neutral-500">· {props.arbol.materia}</span>
      </h1>
      <input
        value={props.busqueda}
        onChange={e => props.onBusqueda(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") props.onBuscar(); }}
        placeholder="Buscar en el canvas… (Enter salta)"
        className="ml-auto w-64 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
      />
      <button onClick={generar} disabled={generando}
        title="Recorre tu árbol y genera el guion de estudio (data/ + bóveda Obsidian)"
        className="rounded-md border border-emerald-800 px-3 py-1.5 text-sm text-emerald-300 enabled:hover:bg-emerald-950 disabled:opacity-40">
        {generando ? "Generando…" : "📜 Guion"}
      </button>
      <button onClick={props.onReordenar} title="Recolocar todos los nodos con el auto-layout"
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
        ⇄ Reordenar
      </button>
      <span className={`w-44 text-right text-xs ${color}`}>{msgGuion || texto}</span>
    </header>
  );
}
