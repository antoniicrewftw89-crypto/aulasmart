"use client";
// Lista de árboles agrupada por materia. TODO pasa por la API (regla del spec).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumenArbol } from "@/lib/arbol/types";

export function ListaArboles() {
  const router = useRouter();
  const [arboles, setArboles] = useState<ResumenArbol[] | null>(null);
  const [error, setError] = useState("");
  const [materia, setMateria] = useState("");
  const [tema, setTema] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/arboles")
      .then(res => res.json())
      .then(setArboles)
      .catch(() => setError("No se pudo cargar la lista"));
  }, []);
  useEffect(() => cargar(), [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true); setError("");
    const res = await fetch("/api/arboles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia, tema }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) { setError(data.error ?? "error al crear"); return; }
    router.push(`/arbol/${data.materia}/${data.tema}`);
  }

  async function eliminar(r: ResumenArbol) {
    if (!confirm(`¿Enviar "${r.titulo}" a la papelera? (recuperable en data/.papelera)`)) return;
    await fetch(`/api/arboles/${r.materia}/${r.tema}`, { method: "DELETE" });
    cargar();
  }

  const porMateria = new Map<string, ResumenArbol[]>();
  for (const r of arboles ?? []) porMateria.set(r.materia, [...(porMateria.get(r.materia) ?? []), r]);

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={crear} className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Materia
          <input value={materia} onChange={e => setMateria(e.target.value)} placeholder="Cálculo Diferencial"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Tema
          <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Límites"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500" />
        </label>
        <button disabled={creando || !materia.trim() || !tema.trim()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-40">
          {creando ? "Creando…" : "＋ Nuevo árbol"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {arboles === null && <p className="text-neutral-500">Cargando…</p>}
      {arboles?.length === 0 && (
        <p className="text-neutral-500">Aún no hay árboles. Crea el primero arriba: tú pones las ideas.</p>
      )}

      {[...porMateria.entries()].map(([m, lista]) => (
        <section key={m}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">{m}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lista.map(r => (
              <li key={`${r.materia}/${r.tema}`}
                className="group flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 hover:border-emerald-600">
                <a href={`/arbol/${r.materia}/${r.tema}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.titulo}</p>
                  <p className="text-xs text-neutral-500">
                    {r.nNodos} nodos · {new Date(r.actualizadoEn).toLocaleDateString("es-CO")}
                  </p>
                </a>
                <button onClick={() => eliminar(r)} title="Enviar a la papelera"
                  className="ml-3 text-neutral-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400">🗑</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
