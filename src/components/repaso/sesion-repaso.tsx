"use client";
// sesion-repaso.tsx — Modo repaso a pantalla completa: una flashcard (sticky
// grande) por vez. Click para voltear, luego "lo sabía / no lo sabía".
// El progreso Leitner se guarda por la API tras cada respuesta.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TarjetaConProgreso } from "@/lib/repaso/tarjetas";

type Estado = "cargando" | "repasando" | "hecho" | "vacio" | "error";

// Marco centrado para los estados no-interactivos. Fuera del componente para
// no recrearlo en cada render (regla de React).
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--papel)] px-6">
      <div className="w-full max-w-xl text-center">{children}</div>
    </main>
  );
}

export function SesionRepaso({ materia, tema }: { materia: string; tema: string }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [titulo, setTitulo] = useState("");
  const [cola, setCola] = useState<TarjetaConProgreso[]>([]);
  const [i, setI] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [aciertos, setAciertos] = useState(0);

  useEffect(() => {
    fetch(`/api/arboles/${materia}/${tema}/repaso`)
      .then(async res => {
        if (!res.ok) { setEstado("error"); return; }
        const data = await res.json();
        setTitulo(data.titulo);
        setCola(data.tarjetas);
        setEstado(data.tarjetas.length ? "repasando" : "vacio");
      })
      .catch(() => setEstado("error"));
  }, [materia, tema]);

  const carta = cola[i];

  const responder = useCallback(async (acierto: boolean) => {
    if (!carta) return;
    if (acierto) setAciertos(a => a + 1);
    fetch(`/api/arboles/${materia}/${tema}/repaso`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodoId: carta.nodoId, acierto }),
    }).catch(() => {});
    setVolteada(false);
    if (i + 1 >= cola.length) setEstado("hecho");
    else setI(i + 1);
  }, [carta, cola.length, i, materia, tema]);

  // Atajos: Espacio voltea · ←/→ responden
  useEffect(() => {
    if (estado !== "repasando") return;
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setVolteada(v => !v); }
      if (volteada && (e.key === "ArrowRight" || e.key === "1")) responder(true);
      if (volteada && (e.key === "ArrowLeft" || e.key === "2")) responder(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [estado, volteada, responder]);

  if (estado === "cargando") return <Marco><p className="manuscrita text-3xl text-[var(--tinta-suave)]">barajando…</p></Marco>;
  if (estado === "error") return <Marco><p className="text-[var(--tinta-suave)]">No se pudo cargar. <Link href="/" className="text-[var(--acento)] underline">Inicio</Link></p></Marco>;

  if (estado === "vacio") {
    return (
      <Marco>
        <p className="manuscrita text-4xl text-[var(--tinta)]">¡todo repasado por hoy! ✨</p>
        <p className="mt-2 text-sm text-[var(--tinta-suave)]">Vuelve mañana, o sigue construyendo el árbol.</p>
        <Acciones materia={materia} tema={tema} />
      </Marco>
    );
  }

  if (estado === "hecho") {
    return (
      <Marco>
        <p className="manuscrita text-4xl text-[var(--tinta)]">sesión completa 🎉</p>
        <p className="mt-2 text-lg text-[var(--tinta)]">{aciertos} de {cola.length} a la primera</p>
        <p className="mt-1 text-sm text-[var(--tinta-suave)]">Las que fallaste vuelven mañana; las acertadas, más adelante.</p>
        <Acciones materia={materia} tema={tema} />
      </Marco>
    );
  }

  // repasando
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--papel)]">
      <header className="flex items-center justify-between px-5 py-3">
        <Link href={`/arbol/${materia}/${tema}`} className="text-sm text-[var(--tinta-suave)] hover:text-[var(--tinta)]">← Volver al lienzo</Link>
        <span className="manuscrita text-xl text-[var(--tinta)]">{titulo}</span>
        <span className="text-sm text-[var(--tinta-suave)]">{i + 1} / {cola.length}</span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <p className="mb-3 text-xs uppercase tracking-widest text-[var(--tinta-suave)]">{carta.ruta}</p>

        <button
          onClick={() => setVolteada(v => !v)}
          className="sombra-sticky flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-3 rounded-lg bg-[#ffe48a] px-8 py-10 text-center transition active:scale-[0.99]"
        >
          {!volteada ? (
            <>
              <span className="text-2xl font-semibold text-[var(--tinta)]">{carta.anverso}</span>
              <span className="manuscrita text-lg text-[rgba(56,52,44,0.5)]">¿qué sabes de esto? · click para ver</span>
            </>
          ) : (
            <span className="whitespace-pre-line text-left text-[15px] leading-relaxed text-[var(--tinta)]">{carta.reverso}</span>
          )}
        </button>

        {volteada ? (
          <div className="mt-6 flex gap-3">
            <button onClick={() => responder(false)}
              className="rounded-xl border-2 border-red-300 px-6 py-3 font-semibold text-red-600 transition hover:bg-red-50 active:scale-95">
              ✗ No lo sabía
            </button>
            <button onClick={() => responder(true)}
              className="rounded-xl bg-[var(--acento)] px-6 py-3 font-semibold text-white transition hover:brightness-110 active:scale-95">
              ✓ Lo sabía
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--tinta-suave)]">Espacio para voltear · ✓ y ✗ con ← →</p>
        )}
      </div>
    </main>
  );
}

function Acciones({ materia, tema }: { materia: string; tema: string }) {
  return (
    <div className="mt-6 flex justify-center gap-3">
      <Link href={`/arbol/${materia}/${tema}`}
        className="rounded-xl bg-[var(--acento)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
        ← Volver al lienzo
      </Link>
      <Link href="/" className="rounded-xl border border-[var(--linea)] px-5 py-2.5 text-sm text-[var(--tinta)] hover:bg-[var(--papel-sombra)]">
        Inicio
      </Link>
    </div>
  );
}
