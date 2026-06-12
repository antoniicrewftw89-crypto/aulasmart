"use client";
// cajon-asistente.tsx — La IA como integración APARTE (lección de Nate:
// "un botón que me permite chequear o investigar un punto"). Vive en un
// cajón cerrado por defecto; el lienzo es 100% tuyo hasta que la llamas.
import { useState } from "react";
import type { NodoArbol } from "@/lib/arbol/types";

export function CajonAsistente(props: {
  abierto: boolean;
  onCerrar: () => void;
  nodo: NodoArbol | null;
  onAccionIA: (accion: "verificar" | "investigar", proveedor: string) => Promise<string | null>;
}) {
  const [proveedor, setProveedor] = useState("auto");
  const [cargando, setCargando] = useState<"verificar" | "investigar" | null>(null);
  const [msg, setMsg] = useState<{ texto: string; error: boolean } | null>(null);

  if (!props.abierto) return null;

  async function lanzar(accion: "verificar" | "investigar") {
    setCargando(accion); setMsg(null);
    const error = await props.onAccionIA(accion, proveedor);
    setCargando(null);
    setMsg(error
      ? { texto: error, error: true }
      : { texto: "Respuesta pegada en las notas del sticky ✓", error: false });
  }

  return (
    <aside className="sombra-caja absolute bottom-16 right-4 z-20 flex w-72 flex-col gap-3 rounded-2xl border border-[var(--linea)] bg-[#fffdf8] p-4">
      <header className="flex items-center justify-between">
        <h2 className="manuscrita text-2xl text-[var(--tinta)]">✨ Ayudante</h2>
        <button onClick={props.onCerrar} className="text-[var(--tinta-suave)] hover:text-[var(--tinta)]">✕</button>
      </header>
      <p className="text-xs leading-relaxed text-[var(--tinta-suave)]">
        Trabaja para tu árbol, nunca lo escribe solo. Elige un sticky y pídele.
      </p>

      {props.nodo ? (
        <>
          <div className="rounded-lg bg-[var(--papel)] px-3 py-2 text-sm font-medium">
            “{props.nodo.texto || "(sticky sin texto)"}”
          </div>
          <div className="flex gap-2">
            <button onClick={() => lanzar("verificar")} disabled={cargando !== null}
              className="flex-1 rounded-xl bg-[var(--acento)] px-2 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:opacity-40">
              {cargando === "verificar" ? "Verificando…" : "🔍 Verificar"}
            </button>
            <button onClick={() => lanzar("investigar")} disabled={cargando !== null}
              className="flex-1 rounded-xl border-2 border-[var(--acento)] px-2 py-2 text-sm font-semibold text-[var(--acento)] transition enabled:hover:bg-[var(--papel-sombra)] enabled:active:scale-95 disabled:opacity-40">
              {cargando === "investigar" ? "Investigando…" : "🔬 Investigar"}
            </button>
          </div>
          <label className="flex items-center justify-between text-xs text-[var(--tinta-suave)]">
            Quién responde
            <select value={proveedor} onChange={e => setProveedor(e.target.value)}
              className="rounded-lg border border-[var(--linea)] bg-white px-2 py-1 text-xs text-[var(--tinta)]">
              <option value="auto">Auto (gratis)</option>
              <option value="claude">Claude (pago)</option>
            </select>
          </label>
          {msg && (
            <p className={`text-xs ${msg.error ? "text-red-600" : "text-[var(--acento)]"}`}>{msg.texto}</p>
          )}
        </>
      ) : (
        <p className="manuscrita text-xl text-[var(--tinta-suave)]">selecciona un sticky del lienzo…</p>
      )}
    </aside>
  );
}
