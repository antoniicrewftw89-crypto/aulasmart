"use client";
// sesion-repaso.tsx — Modo repaso a pantalla completa, multiformato:
//   · "voltear": tarjeta con giro 3D real (concepto → explicación).
//   · "opcion": opción múltiple, la correcta se ilumina verde y el fallo rojo.
// Barra de progreso arriba; el progreso Leitner se guarda por la API tras cada
// respuesta (acierto = supiste / elegiste la correcta).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TarjetaSesion } from "@/lib/repaso/tarjetas";

type Estado = "cargando" | "repasando" | "hecho" | "vacio" | "error";

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
  const [cola, setCola] = useState<TarjetaSesion[]>([]);
  const [i, setI] = useState(0);
  const [volteada, setVolteada] = useState(false);     // tarjetas "voltear"
  const [elegida, setElegida] = useState<number | null>(null); // tarjetas "opcion"
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

  const item = cola[i];

  const avanzar = useCallback((acierto: boolean) => {
    if (!item) return;
    if (acierto) setAciertos(a => a + 1);
    fetch(`/api/arboles/${materia}/${tema}/repaso`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodoId: item.tarjeta.nodoId, acierto }),
    }).catch(() => {});
    setVolteada(false);
    setElegida(null);
    if (i + 1 >= cola.length) setEstado("hecho");
    else setI(i + 1);
  }, [item, cola.length, i, materia, tema]);

  const elegirOpcion = useCallback((idx: number) => {
    if (elegida !== null || !item || item.tarjeta.tipo !== "opcion") return;
    setElegida(idx);
  }, [elegida, item]);

  // Teclado
  useEffect(() => {
    if (estado !== "repasando" || !item) return;
    const h = (e: KeyboardEvent) => {
      if (item.tarjeta.tipo === "voltear") {
        if (e.code === "Space") { e.preventDefault(); setVolteada(v => !v); }
        if (volteada && (e.key === "ArrowRight" || e.key === "1")) avanzar(true);
        if (volteada && (e.key === "ArrowLeft" || e.key === "2")) avanzar(false);
      } else {
        const carta = item.tarjeta; // narrowing: aquí es "opcion"
        if (elegida === null && ["1", "2", "3", "4"].includes(e.key)) elegirOpcion(Number(e.key) - 1);
        if (elegida !== null && (e.key === "Enter" || e.key === "ArrowRight")) {
          avanzar(elegida === carta.correcta);
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [estado, item, volteada, elegida, avanzar, elegirOpcion]);

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

  const progreso = Math.round((i / cola.length) * 100);

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--papel)]">
      {/* Barra de progreso */}
      <div className="h-1.5 w-full bg-[var(--linea)]">
        <div className="h-full bg-[var(--acento)] transition-all duration-300" style={{ width: `${progreso}%` }} />
      </div>

      <header className="flex items-center justify-between px-5 py-3">
        <Link href={`/arbol/${materia}/${tema}`} className="text-sm text-[var(--tinta-suave)] hover:text-[var(--tinta)]">← Volver al lienzo</Link>
        <span className="manuscrita text-xl text-[var(--tinta)]">{titulo}</span>
        <span className="text-sm text-[var(--tinta-suave)]">{i + 1} / {cola.length}</span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <p className="mb-4 text-xs uppercase tracking-widest text-[var(--tinta-suave)]">{item.ruta}</p>

        {item.tarjeta.tipo === "voltear"
          ? <CartaVoltear t={item.tarjeta} volteada={volteada} onVoltear={() => setVolteada(v => !v)} onResponder={avanzar} />
          : <CartaOpcion t={item.tarjeta} elegida={elegida} onElegir={elegirOpcion} onResponder={avanzar} />}
      </div>
    </main>
  );
}

// --- Tarjeta de volteo 3D -------------------------------------------------- #
function CartaVoltear(props: {
  t: { anverso: string; reverso: string };
  volteada: boolean;
  onVoltear: () => void;
  onResponder: (acierto: boolean) => void;
}) {
  return (
    <>
      <button onClick={props.onVoltear} className="w-full max-w-xl [perspective:1400px]" aria-label="Voltear tarjeta">
        <div
          className={`relative min-h-64 w-full transition-transform duration-500 [transform-style:preserve-3d] ${props.volteada ? "[transform:rotateY(180deg)]" : ""}`}
        >
          {/* Cara frontal */}
          <div className="sombra-sticky absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#ffe48a] px-8 py-10 [backface-visibility:hidden]">
            <span className="text-2xl font-semibold text-[var(--tinta)]">{props.t.anverso}</span>
            <span className="manuscrita text-lg text-[rgba(56,52,44,0.5)]">¿qué sabes de esto? · click para girar</span>
          </div>
          {/* Cara trasera */}
          <div className="sombra-sticky absolute inset-0 flex items-center justify-center rounded-2xl bg-[#fffdf8] px-8 py-10 [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <span className="whitespace-pre-line text-left text-[15px] leading-relaxed text-[var(--tinta)]">{props.t.reverso}</span>
          </div>
        </div>
      </button>

      {props.volteada ? (
        <div className="mt-6 flex gap-3">
          <button onClick={() => props.onResponder(false)}
            className="rounded-xl border-2 border-red-300 px-6 py-3 font-semibold text-red-600 transition hover:bg-red-50 active:scale-95">
            ✗ No lo sabía
          </button>
          <button onClick={() => props.onResponder(true)}
            className="rounded-xl bg-[var(--acento)] px-6 py-3 font-semibold text-white transition hover:brightness-110 active:scale-95">
            ✓ Lo sabía
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--tinta-suave)]">Espacio para girar · ✓ y ✗ con ← →</p>
      )}
    </>
  );
}

// --- Tarjeta de opción múltiple -------------------------------------------- #
function CartaOpcion(props: {
  t: { pregunta: string; opciones: string[]; correcta: number; explica: string };
  elegida: number | null;
  onElegir: (idx: number) => void;
  onResponder: (acierto: boolean) => void;
}) {
  const { t, elegida } = props;
  const respondida = elegida !== null;

  const claseOpcion = (idx: number): string => {
    if (!respondida) return "border-[var(--linea)] bg-[#fffdf8] hover:border-[var(--acento)] hover:bg-[var(--papel-sombra)]";
    if (idx === t.correcta) return "border-emerald-500 bg-emerald-50 text-emerald-800";
    if (idx === elegida) return "border-red-400 bg-red-50 text-red-700";
    return "border-[var(--linea)] bg-[#fffdf8] opacity-60";
  };

  return (
    <div className="w-full max-w-xl">
      <div className="sombra-sticky mb-5 rounded-2xl bg-[#ffe48a] px-7 py-6">
        <p className="whitespace-pre-line text-center text-lg font-semibold text-[var(--tinta)]">{t.pregunta}</p>
      </div>

      <div className="grid gap-2.5">
        {t.opciones.map((op, idx) => (
          <button key={idx} onClick={() => props.onElegir(idx)} disabled={respondida}
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] text-[var(--tinta)] transition active:scale-[0.99] ${claseOpcion(idx)}`}>
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border border-current text-xs font-bold">{idx + 1}</span>
            <span>{op}</span>
            {respondida && idx === t.correcta && <span className="ml-auto">✓</span>}
            {respondida && idx === elegida && idx !== t.correcta && <span className="ml-auto">✗</span>}
          </button>
        ))}
      </div>

      {respondida && (
        <div className="mt-5 flex flex-col items-center gap-3">
          {t.explica.trim() && <p className="text-center text-sm text-[var(--tinta-suave)]">{t.explica}</p>}
          <button onClick={() => props.onResponder(elegida === t.correcta)}
            className="rounded-xl bg-[var(--acento)] px-8 py-3 font-semibold text-white transition hover:brightness-110 active:scale-95">
            Siguiente →
          </button>
        </div>
      )}
      {!respondida && <p className="mt-5 text-center text-sm text-[var(--tinta-suave)]">Elige con el ratón o teclas 1-4</p>}
    </div>
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
