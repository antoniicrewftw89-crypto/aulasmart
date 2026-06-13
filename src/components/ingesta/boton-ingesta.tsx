"use client";
// boton-ingesta.tsx — El botón 📥 de la pantalla de inicio: abre el cajón de
// ingesta para crear un árbol nuevo desde material.
import { useState } from "react";
import { CajonIngesta } from "./cajon-ingesta";

export function BotonIngesta() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-xl border border-[var(--linea)] bg-[#fffdf8] px-4 py-2 text-sm font-semibold text-[var(--tinta)] transition hover:bg-[var(--papel-sombra)] active:scale-95"
      >
        📥 Ingerir material
      </button>
      <CajonIngesta abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  );
}
