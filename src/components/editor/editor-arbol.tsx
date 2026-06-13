"use client";
// editor-arbol.tsx — La mesa de estudio: papel punteado, stickies, caja de
// herramientas a la izquierda (con paleta tipo Paint) y la IA en su cajón ✨.
// Teclado: Tab hijo · Enter hermano · F2/doble-click editar · Supr quitar.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  type Connection, type Edge, type Node, type NodeChange, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { aFlow } from "@/lib/arbol/a-flow";
import { raizDe } from "@/lib/arbol/modelo";
import { useArbolEditor, type EstadoGuardado } from "./use-arbol-editor";
import { NodoIdea, type NodoIdeaFlow } from "./nodo-idea";
import { PanelNodo } from "./panel-nodo";
import { CajaHerramientas } from "./caja-herramientas";
import { CajonAsistente } from "./cajon-asistente";

const tiposDeNodo = { idea: NodoIdea };

const CHIP_GUARDADO: Record<EstadoGuardado, [string, string]> = {
  guardado: ["Guardado ✓", "text-[var(--acento)]"],
  guardando: ["Guardando…", "text-[var(--tinta-suave)]"],
  pendiente: ["Sin guardar…", "text-amber-600"],
  error: ["⚠ Error al guardar", "text-red-600"],
};

function Lienzo({ materia, tema }: { materia: string; tema: string }) {
  const ed = useArbolEditor(materia, tema);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  // Un lienzo recién nacido te recibe escribiendo en su sticky central
  const [autoEdicionCerrada, setAutoEdicionCerrada] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);
  const [aviso, setAviso] = useState("");
  // Posiciones "en vivo" durante el drag (antes de commitear al árbol)
  const [posDrag, setPosDrag] = useState<Record<string, { x: number; y: number }>>({});
  const [pendientesRepaso, setPendientesRepaso] = useState(0);
  const flow = useReactFlow();
  const router = useRouter();

  // Cuántas tarjetas tocan hoy (badge del botón de repaso). Se recalcula al cargar.
  useEffect(() => {
    fetch(`/api/arboles/${materia}/${tema}/repaso`)
      .then(res => (res.ok ? res.json() : null))
      .then(d => { if (d) setPendientesRepaso(d.pendientes); })
      .catch(() => {});
  }, [materia, tema, ed.arbol]);

  const avisar = useCallback((msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(""), 3500);
  }, []);

  const onTexto = useCallback((id: string, texto: string) => ed.editarNodo(id, { texto }), [ed]);
  const onEditar = useCallback((id: string | null) => {
    if (id === null) setAutoEdicionCerrada(true);
    setEditando(id);
  }, []);

  // Sin formularios: si el lienzo acaba de nacer (solo la raíz, sin texto),
  // se abre directamente escribiendo en el sticky central.
  const editandoEfectivo = editando
    ?? (!autoEdicionCerrada && ed.arbol && ed.arbol.nodos.length === 1 && !raizDe(ed.arbol).texto
      ? raizDe(ed.arbol).id
      : null);

  const { nodes, edges } = useMemo(() => {
    if (!ed.arbol) return { nodes: [] as Node[], edges: [] as Edge[] };
    const q = busqueda.trim().toLowerCase();
    const proy = aFlow(ed.arbol);
    return {
      edges: proy.edges,
      nodes: proy.nodes.map(n => ({
        ...n,
        position: posDrag[n.id] ?? n.position,
        selected: n.id === seleccion,
        data: {
          ...n.data,
          editando: n.id === editandoEfectivo,
          resaltado: q.length > 1 && n.data.nodo.texto.toLowerCase().includes(q),
          onTexto, onEditar,
        },
      }) as NodoIdeaFlow),
    };
  }, [ed.arbol, seleccion, editandoEfectivo, busqueda, posDrag, onTexto, onEditar]);

  const onNodesChange = useCallback((cambios: NodeChange[]) => {
    for (const c of cambios) {
      if (c.type === "position" && c.position) {
        if (c.dragging) {
          const pos = c.position;
          setPosDrag(p => ({ ...p, [c.id]: pos }));
        } else {
          ed.editarNodo(c.id, { posicion: c.position });
          setPosDrag(p => { const resto = { ...p }; delete resto[c.id]; return resto; });
        }
      }
      if (c.type === "select") setSeleccion(s => (c.selected ? c.id : s === c.id ? null : s));
    }
  }, [ed]);

  const crearHijo = useCallback((padreId: string) => {
    const id = ed.agregarHijo(padreId);
    if (id) { setSeleccion(id); setEditando(id); }
  }, [ed]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return; // escribir nunca dispara atajos
    if (!ed.arbol) return;
    const sel = seleccion ?? raizDe(ed.arbol).id;
    if (e.key === "Tab") { e.preventDefault(); crearHijo(sel); }
    if (e.key === "Enter") {
      e.preventDefault();
      const id = ed.agregarHermano(sel);
      if (id) { setSeleccion(id); setEditando(id); }
    }
    if (e.key === "F2") { e.preventDefault(); setEditando(sel); }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (seleccion) { ed.eliminarNodo(seleccion); setSeleccion(null); }
    }
  }, [ed, seleccion, crearHijo]);

  const irAlPrimero = useCallback(() => {
    const q = busqueda.trim().toLowerCase();
    const n = ed.arbol?.nodos.find(x => x.texto.toLowerCase().includes(q));
    if (!n) return;
    const enCanvas = nodes.find(x => x.id === n.id);
    if (enCanvas) flow.setCenter(enCanvas.position.x, enCanvas.position.y, { zoom: 1.2, duration: 400 });
  }, [busqueda, ed.arbol, nodes, flow]);

  // La IA solo actúa cuando el humano la llama desde el cajón. Error o null.
  const accionIA = async (nodoId: string, accion: "verificar" | "investigar", proveedor: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/arboles/${materia}/${tema}/nodos/${nodoId}/${accion}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor }),
      });
      const data = await res.json();
      if (!res.ok) return data.error ?? "la IA no pudo responder";
      ed.reemplazarArbol(data.arbol);
      return null;
    } catch { return "sin conexión con el servidor"; }
  };

  if (ed.noEncontrado) {
    return (
      <main className="grid h-dvh place-items-center text-[var(--tinta-suave)]">
        <p>Este árbol no existe. <Link href="/" className="text-[var(--acento)] underline">Volver a la mesa</Link></p>
      </main>
    );
  }
  if (!ed.arbol) {
    return <main className="manuscrita grid h-dvh place-items-center text-3xl text-[var(--tinta-suave)]">preparando el papel…</main>;
  }

  const nodoSel = seleccion ? ed.arbol.nodos.find(n => n.id === seleccion) ?? null : null;
  const [textoGuardado, colorGuardado] = CHIP_GUARDADO[ed.guardado];

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} className="relative h-dvh outline-none">
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={tiposDeNodo}
        onNodesChange={onNodesChange}
        onConnect={(c: Connection) => { if (c.source && c.target) ed.conectar(c.source, c.target); }}
        onEdgeDoubleClick={(_e, edge) => { if (edge.id.startsWith("r-")) ed.desconectar(edge.id.slice(2)); }}
        onDoubleClick={() => { if (ed.arbol) crearHijo(seleccion ?? raizDe(ed.arbol).id); }}
        onPaneClick={() => { setSeleccion(null); setEditando(null); }}
        fitView zoomOnDoubleClick={false} deleteKeyCode={null}
        className="!bg-[var(--papel)]"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#d8cfba" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap pannable zoomable position="top-right"
          className="!bg-[#fffdf8]" nodeColor={n => (n as NodoIdeaFlow).data?.nodo?.color ?? "#ffe48a"} />
      </ReactFlow>

      {/* Cabecera flotante: volver + título manuscrito */}
      <header className="absolute left-4 top-4 z-10 flex items-center gap-3">
        <Link href="/" title="Volver a la mesa"
          className="sombra-caja grid h-10 w-10 place-items-center rounded-xl border border-[var(--linea)] bg-[#fffdf8] text-lg hover:bg-[var(--papel-sombra)]">
          ←
        </Link>
        <div className="sombra-caja rounded-xl border border-[var(--linea)] bg-[#fffdf8] px-4 py-1.5">
          <span className="manuscrita text-2xl leading-none text-[var(--tinta)]">
            {ed.arbol.titulo || "sin título…"}
          </span>
          <span className="ml-2 text-xs text-[var(--tinta-suave)]">
            {ed.arbol.materia === "ideas" ? "✏ idea suelta" : ed.arbol.materia}
          </span>
        </div>
      </header>

      {/* Búsqueda flotante, centrada arriba */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") irAlPrimero(); }}
          placeholder="buscar en el lienzo…"
          className="sombra-caja w-64 rounded-full border border-[var(--linea)] bg-[#fffdf8] px-4 py-2 text-sm text-[var(--tinta)] outline-none placeholder:text-[var(--tinta-suave)] focus:border-[var(--acento)]"
        />
      </div>

      <CajaHerramientas
        haySeleccion={Boolean(nodoSel)}
        pendientesRepaso={pendientesRepaso}
        onNuevoSticky={() => { if (ed.arbol) crearHijo(seleccion ?? raizDe(ed.arbol).id); }}
        onPintar={color => { if (nodoSel) ed.editarNodo(nodoSel.id, { color }); }}
        onReordenar={ed.reordenar}
        onRepasar={() => router.push(`/arbol/${materia}/${tema}/repaso`)}
        onGenerarMazo={async () => {
          const generar = (motor: "auto" | "determinista") =>
            fetch(`/api/arboles/${materia}/${tema}/tarjetas`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ motor }),
            });
          try {
            let res = await generar("auto");
            let data = await res.json();
            if (res.status === 503 && data.sinClave) {
              // sin clave de IA: caemos a preguntas básicas (sin gastar nada)
              res = await generar("determinista");
              data = await res.json();
              return res.ok
                ? "🪄 Preguntas básicas listas (pon una clave de IA en .env.local para preguntas mejores)"
                : `⚠ ${data.error ?? "no se pudo generar"}`;
            }
            if (!res.ok) return `⚠ ${data.error ?? "no se pudo generar"}`;
            return data.motor === "ia"
              ? `🪄 Preguntas generadas con IA (${data.proveedor}) — dale al 🎴`
              : "🪄 Preguntas básicas listas — dale al 🎴";
          } catch { return "⚠ sin conexión con el servidor"; }
        }}
        onGenerarGuion={async () => {
          try {
            const res = await fetch(`/api/arboles/${materia}/${tema}/generar/guion`, { method: "POST" });
            const data = await res.json();
            return res.ok ? null : (data.error ?? "no se pudo generar");
          } catch { return "sin conexión con el servidor"; }
        }}
        onGenerarSlides={async () => {
          try {
            const res = await fetch(`/api/arboles/${materia}/${tema}/generar/slides`, { method: "POST" });
            const data = await res.json();
            return res.ok ? null : (data.error ?? "no se pudo generar");
          } catch { return "sin conexión con el servidor"; }
        }}
        onAviso={avisar}
      />

      {nodoSel && !asistenteAbierto && (
        <PanelNodo
          nodo={nodoSel}
          onCambios={c => ed.editarNodo(nodoSel.id, c)}
          onEliminar={() => { ed.eliminarNodo(nodoSel.id); setSeleccion(null); }}
          onCerrar={() => setSeleccion(null)}
        />
      )}

      {/* La IA, aparte: un botón pequeño que abre su cajón */}
      <button
        onClick={() => setAsistenteAbierto(a => !a)}
        title="Ayudante IA (solo actúa si tú le pides)"
        className={`sombra-caja absolute bottom-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full border text-lg transition active:scale-90
          ${asistenteAbierto ? "border-[var(--acento)] bg-[var(--acento)] text-white" : "border-[var(--linea)] bg-[#fffdf8] hover:bg-[var(--papel-sombra)]"}`}
      >
        ✨
      </button>
      <CajonAsistente
        abierto={asistenteAbierto}
        onCerrar={() => setAsistenteAbierto(false)}
        nodo={nodoSel}
        onAccionIA={(accion, proveedor) => nodoSel ? accionIA(nodoSel.id, accion, proveedor) : Promise.resolve("selecciona un sticky")}
      />

      {/* Chip de guardado + avisos, abajo al centro */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <span className={`sombra-caja rounded-full border border-[var(--linea)] bg-[#fffdf8] px-4 py-1.5 text-xs font-semibold ${aviso ? "text-[var(--tinta)]" : colorGuardado}`}>
          {aviso || textoGuardado}
        </span>
      </div>
    </div>
  );
}

export function EditorArbol(props: { materia: string; tema: string }) {
  return (
    <ReactFlowProvider>
      <Lienzo {...props} />
    </ReactFlowProvider>
  );
}
