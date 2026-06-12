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
  onNuevoSticky: () => void;
  onPintar: (color: string) => void;
  onReordenar: () => void;
  onGenerarGuion: () => Promise<string | null>;
  onAviso: (msg: string) => void;
}) {
  const [generando, setGenerando] = useState(false);

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
      <Herramienta titulo="Reordenar todo con el auto-layout" onClick={props.onReordenar}>
        ⇄
      </Herramienta>

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
