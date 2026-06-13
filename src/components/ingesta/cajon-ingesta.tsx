"use client";
// cajon-ingesta.tsx — F5: el cajón para meter material (pegar texto o soltar
// PDF/TXT) y mandarlo a /api/ingesta. Al volver, lleva al editor en modo
// revisión (?revisar=1) para aprobar el borrador que propuso la IA.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CajonIngesta(props: {
  abierto: boolean;
  onCerrar: () => void;
  materiaActual?: string;
  temaActual?: string;
  nodoDestinoId?: string;   // dónde colgar si se fusiona (nodo elegido o la raíz)
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fusionar, setFusionar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!props.abierto) return null;
  const puedeFusionar = Boolean(props.materiaActual && props.temaActual && props.nodoDestinoId);

  async function ingerir() {
    setError(null);
    if (!texto.trim() && !archivo) { setError("Pega texto o elige un archivo."); return; }
    setCargando(true);
    const fd = new FormData();
    if (texto.trim()) fd.set("texto", texto);
    if (archivo) fd.set("archivo", archivo);
    fd.set("destino", JSON.stringify(
      fusionar && puedeFusionar
        ? { tipo: "fusionar", materia: props.materiaActual, tema: props.temaActual, nodoId: props.nodoDestinoId }
        : { tipo: "nuevo" },
    ));
    try {
      const res = await fetch("/api/ingesta", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.sinClave
          ? "Para esto necesitas una clave de IA gratis (Groq o Gemini) en .env.local."
          : (data.error ?? "No se pudo ingerir el material."));
        setCargando(false);
        return;
      }
      // Borrador guardado: al editor en modo revisión.
      router.push(`/arbol/${data.materia}/${data.tema}?revisar=1`);
    } catch {
      setError("Sin conexión con el servidor.");
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(40,36,28,0.45)] px-4" onClick={props.onCerrar}>
      <div
        className="sombra-caja w-full max-w-lg rounded-2xl border border-[var(--linea)] bg-[var(--papel)] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="manuscrita text-3xl text-[var(--tinta)]">ingerir material 📥</h2>
          <button onClick={props.onCerrar} className="text-[var(--tinta-suave)] hover:text-[var(--tinta)]">✕</button>
        </div>
        <p className="mb-4 text-sm text-[var(--tinta-suave)]">
          Pega texto, suelta un PDF/TXT o un <b>audio/vídeo de clase</b> (se transcribe solo).
          La IA propone un árbol que tú apruebas — no escribe nada sin tu visto bueno.
        </p>

        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Pega aquí la transcripción, los apuntes, el resumen…"
          className="h-40 w-full resize-none rounded-xl border border-[var(--linea)] bg-[#fffdf8] p-3 text-sm text-[var(--tinta)] outline-none focus:border-[var(--acento)]"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-[var(--linea)] bg-[#fffdf8] px-4 py-2 text-sm text-[var(--tinta)] hover:bg-[var(--papel-sombra)]"
          >
            📎 Elegir archivo
          </button>
          <span className="truncate text-xs text-[var(--tinta-suave)]">{archivo ? archivo.name : "PDF · audio · vídeo · TXT"}</span>
          <input
            ref={fileRef} type="file"
            accept=".pdf,.txt,text/plain,application/pdf,audio/*,video/*,.mp3,.m4a,.wav,.ogg,.mp4,.webm"
            className="hidden"
            onChange={e => setArchivo(e.target.files?.[0] ?? null)}
          />
        </div>

        {puedeFusionar && (
          <label className="mt-4 flex items-start gap-2 text-sm text-[var(--tinta)]">
            <input type="checkbox" checked={fusionar} onChange={e => setFusionar(e.target.checked)} className="mt-1" />
            <span>Añadir a <b>este tema</b> como una rama (bajo el nodo seleccionado o la raíz). Si lo dejas sin marcar, se crea un árbol nuevo.</span>
          </label>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={props.onCerrar} className="rounded-xl px-4 py-2 text-sm text-[var(--tinta-suave)] hover:text-[var(--tinta)]">
            Cancelar
          </button>
          <button
            onClick={ingerir} disabled={cargando}
            className="rounded-xl bg-[var(--acento)] px-6 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {cargando ? "Procesando… (el audio tarda un poco)" : "Crear borrador →"}
          </button>
        </div>
      </div>
    </div>
  );
}
