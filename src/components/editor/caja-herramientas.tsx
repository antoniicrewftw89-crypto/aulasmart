"use client";
// caja-herramientas.tsx — La caja vertical estilo Paint: herramientas arriba,
// LA PALETA SIEMPRE VISIBLE abajo. Clic en un color = pintas el sticky
// seleccionado (el bote de pintura de toda la vida).
import { useState } from "react";

export const PALETA_STICKIES = [
  "#ffe48a", "#ffb9c5", "#b9e6c4", "#b5dcf5", "#d9c8f2", "#ffc89e",
];

function Herramienta(props: {
  titulo: string; onClick?: () => void; deshabilitada?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.deshabilitada}
      title={props.titulo}
      className="grid h-10 w-10 place-items-center rounded-xl text-lg transition
        enabled:hover:bg-[var(--papel-sombra)] enabled:active:scale-90 disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}

export function CajaHerramientas(props: {
  haySeleccion: boolean;
  pendientesRepaso: number;
  onNuevoSticky: () => void;
  onPintar: (color: string) => void;
  onReordenar: () => void;
  onGenerarGuion: () => Promise<string | null>;
  onRepasar: () => void;
  onAviso: (msg: string) => void;
}) {
  const [generando, setGenerando] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  async function generar() {
    setGenerando(true);
    const error = await props.onGenerarGuion();
    setGenerando(false);
    props.onAviso(error ? `⚠ ${error}` : "📜 Guion guardado en data/ y en tu bóveda");
  }

  return (
    <aside className="sombra-caja absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-[var(--linea)] bg-[#fffdf8] p-2">
      <Herramienta titulo="Nuevo sticky (Tab = hijo · Enter = hermano · doble click en el lienzo)" onClick={props.onNuevoSticky}>
        ➕
      </Herramienta>
      <Herramienta titulo={generando ? "Generando guion…" : "Generar guion de estudio desde tu árbol"} onClick={generar} deshabilitada={generando}>
        {generando ? "⏳" : "📜"}
      </Herramienta>
      <div className="relative">
        <Herramienta titulo="Repasar con flashcards (Leitner)" onClick={props.onRepasar}>
          🎴
        </Herramienta>
        {props.pendientesRepaso > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--acento)] px-1 text-[10px] font-bold text-white">
            {props.pendientesRepaso}
          </span>
        )}
      </div>
      <Herramienta titulo="Reordenar todo con el auto-layout" onClick={props.onReordenar}>
        ⇄
      </Herramienta>
      <Herramienta titulo="Atajos del lienzo" onClick={() => setAyuda(a => !a)}>
        ?
      </Herramienta>

      {ayuda && (
        <div className="sombra-caja absolute left-14 top-0 w-60 rounded-2xl border border-[var(--linea)] bg-[#fffdf8] p-4 text-xs leading-relaxed text-[var(--tinta)]">
          <p className="manuscrita mb-2 text-xl">así se usa la mesa</p>
          <ul className="flex flex-col gap-1.5">
            <li><b>doble click</b> en el papel → sticky nuevo</li>
            <li><b>Tab</b> → hijo · <b>Enter</b> → hermano</li>
            <li><b>doble click</b> en un sticky → escribir</li>
            <li><b>arrastrar</b> → mover (se queda donde lo dejes)</li>
            <li><b>arrastrar borde → borde</b> → conectar ideas</li>
            <li><b>doble click en una flecha</b> → quitarla</li>
            <li><b>Supr</b> → quitar sticky e hijos</li>
            <li><b>paleta</b> → pinta el sticky seleccionado</li>
            <li><b>✨</b> → la IA, solo si tú la llamas</li>
          </ul>
        </div>
      )}

      <div className="my-1 h-px w-7 bg-[var(--linea)]" />

      {/* La paleta: el alma Paint de la caja */}
      <div className="flex flex-col gap-1.5 pb-1">
        {PALETA_STICKIES.map(c => (
          <button
            key={c}
            onClick={() => props.haySeleccion ? props.onPintar(c) : props.onAviso("selecciona un sticky para pintarlo")}
            title={props.haySeleccion ? "Pintar el sticky seleccionado" : "Primero selecciona un sticky"}
            style={{ backgroundColor: c }}
            className={`h-6 w-6 rounded-full border border-[rgba(56,52,44,0.15)] transition hover:scale-110 active:scale-90 ${props.haySeleccion ? "" : "opacity-60"}`}
          />
        ))}
      </div>
    </aside>
  );
}
