"use client";
// barra-revision.tsx — F5: la barra que aparece sobre el lienzo cuando llegas
// de una ingesta (?revisar=1). Une las tres formas de aprobar el borrador:
//   · Aceptar todo (de golpe)   · Siguiente sin revisar (nodo a nodo)
//   · y la edición libre del lienzo de siempre.
import type { Arbol } from "@/lib/arbol/types";

export function BarraRevision(props: {
  arbol: Arbol;
  seleccionId: string | null;
  onSeleccionar: (id: string) => void;
  onAceptar: (id: string) => void;     // un nodo → verificado
  onAceptarTodo: () => void;
  onQuitar: (id: string) => void;      // eliminar nodo (y sus hijos)
  onHecho: () => void;
}) {
  const { arbol } = props;
  // Raíz = el título: no se revisa. Pendiente = nodo en borrador.
  const noRaiz = arbol.nodos.filter(n => n.padreId !== null);
  const pendientes = noRaiz.filter(n => n.estado === "borrador");
  const revisados = noRaiz.length - pendientes.length;

  const siguiente = () => {
    if (!pendientes.length) return;
    const ids = pendientes.map(n => n.id);
    const idx = props.seleccionId ? ids.indexOf(props.seleccionId) : -1;
    props.onSeleccionar(ids[(idx + 1) % ids.length]); // circular sobre los pendientes
  };

  const sel = props.seleccionId ? arbol.nodos.find(n => n.id === props.seleccionId) : null;
  const selRevisable = Boolean(sel && sel.padreId !== null && sel.estado === "borrador");

  return (
    <div className="sombra-caja absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[var(--acento)] bg-[#fffdf8] px-3 py-2">
      <span className="px-1 text-sm text-[var(--tinta)]">Revisando · <b>{revisados}/{noRaiz.length}</b></span>
      <span className="mx-1 h-5 w-px bg-[var(--linea)]" />
      <button onClick={siguiente} disabled={!pendientes.length}
        className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--tinta)] transition hover:bg-[var(--papel-sombra)] disabled:opacity-40">
        ➡ Siguiente ({pendientes.length})
      </button>
      {selRevisable && (
        <>
          <button onClick={() => props.onAceptar(props.seleccionId!)} title="Marcar este nodo como verificado"
            className="rounded-lg px-2.5 py-1.5 text-sm text-emerald-700 transition hover:bg-emerald-50">✅ Aceptar</button>
          <button onClick={() => props.onQuitar(props.seleccionId!)} title="Quitar este nodo y sus hijos"
            className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50">🗑 Quitar</button>
        </>
      )}
      <span className="mx-1 h-5 w-px bg-[var(--linea)]" />
      <button onClick={props.onAceptarTodo} disabled={!pendientes.length}
        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--acento)] transition hover:bg-[var(--papel-sombra)] disabled:opacity-40">
        ✅ Aceptar todo
      </button>
      <button onClick={props.onHecho}
        className="rounded-lg bg-[var(--acento)] px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-95">
        Hecho ✓
      </button>
    </div>
  );
}
