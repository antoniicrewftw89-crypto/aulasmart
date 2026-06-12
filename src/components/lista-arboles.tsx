"use client";
// Lista de árboles agrupada por materia: cada árbol es un sticky sobre la
// mesa. TODO pasa por la API (regla del spec).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumenArbol } from "@/lib/arbol/types";

// El color del sticky depende de la materia: la misma materia, el mismo color.
const COLORES = ["#ffe48a", "#ffb9c5", "#b9e6c4", "#b5dcf5", "#d9c8f2", "#ffc89e"];
function colorDeMateria(materia: string): string {
  let h = 0;
  for (const c of materia) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORES[Math.abs(h) % COLORES.length];
}

export function ListaArboles() {
  const router = useRouter();
  const [arboles, setArboles] = useState<ResumenArbol[] | null>(null);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/arboles")
      .then(res => res.json())
      .then(setArboles)
      .catch(() => setError("No se pudo cargar la lista"));
  }, []);
  useEffect(() => cargar(), [cargar]);

  // Crear es libre, como abrir Paint: un click y a pensar. El lienzo se
  // nombra solo cuando escribes en su sticky central.
  async function nuevoLienzo() {
    setCreando(true); setError("");
    const res = await fetch("/api/arboles", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) { setError(data.error ?? "error al crear"); return; }
    router.push(`/arbol/${data.materia}/${data.tema}`);
  }

  async function mover(r: ResumenArbol) {
    const nueva = prompt(`¿A qué materia llevo "${r.titulo || "este lienzo"}"?`, r.materia === "ideas" ? "" : r.materia);
    if (nueva === null || !nueva.trim()) return;
    const res = await fetch(`/api/arboles/${r.materia}/${r.tema}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia: nueva }),
    });
    if (!res.ok) setError((await res.json()).error ?? "no se pudo mover");
    cargar();
  }

  async function eliminar(r: ResumenArbol) {
    if (!confirm(`¿Enviar "${r.titulo || "este lienzo"}" a la papelera? (recuperable en data/.papelera)`)) return;
    await fetch(`/api/arboles/${r.materia}/${r.tema}`, { method: "DELETE" });
    cargar();
  }

  const porMateria = new Map<string, ResumenArbol[]>();
  for (const r of arboles ?? []) porMateria.set(r.materia, [...(porMateria.get(r.materia) ?? []), r]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <button onClick={nuevoLienzo} disabled={creando}
          className="sombra-caja rounded-2xl bg-[var(--acento)] px-7 py-3.5 text-lg font-bold text-white transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:opacity-40">
          {creando ? "Abriendo…" : "＋ Nuevo lienzo"}
        </button>
        <p className="manuscrita text-xl text-[var(--tinta-suave)]">
          en blanco, como debe ser — se nombra solo cuando escribes la idea central
        </p>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>

      {arboles === null && <p className="manuscrita text-2xl text-[var(--tinta-suave)]">preparando la mesa…</p>}
      {arboles?.length === 0 && (
        <p className="manuscrita text-2xl text-[var(--tinta-suave)]">
          la mesa está vacía — pega tu primer sticky arriba ↑
        </p>
      )}

      {[...porMateria.entries()].map(([m, lista]) => (
        <section key={m}>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--tinta-suave)]">
            {m === "ideas" ? "✏ ideas sueltas" : m}
          </h2>
          <ul className="grid gap-5 sm:grid-cols-3">
            {lista.map((r, i) => (
              <li key={`${r.materia}/${r.tema}`}
                style={{ backgroundColor: colorDeMateria(r.materia), transform: `rotate(${((i % 3) - 1) * 1.2}deg)` }}
                className="sombra-sticky group relative rounded-sm transition-transform hover:rotate-0 hover:scale-[1.03]">
                <a href={`/arbol/${r.materia}/${r.tema}`} className="block px-4 pb-3 pt-4">
                  <p className="manuscrita text-2xl leading-tight text-[var(--tinta)]">
                    {r.titulo || <span className="text-[rgba(56,52,44,0.45)]">sin título…</span>}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[rgba(56,52,44,0.55)]">
                    {r.nNodos} {r.nNodos === 1 ? "idea" : "ideas"} · {new Date(r.actualizadoEn).toLocaleDateString("es-CO")}
                  </p>
                </a>
                <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => mover(r)} title="Mover a otra materia"
                    className="text-[rgba(56,52,44,0.4)] hover:!text-[var(--acento)]">✎</button>
                  <button onClick={() => eliminar(r)} title="Enviar a la papelera"
                    className="text-[rgba(56,52,44,0.4)] hover:!text-red-600">✕</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
