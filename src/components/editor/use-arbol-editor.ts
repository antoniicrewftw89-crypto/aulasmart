"use client";
// use-arbol-editor.ts — Estado del editor: árbol en memoria, mutaciones del
// modelo y autosave con debounce. El humano edita; aquí no hay IA.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Arbol } from "@/lib/arbol/types";
import * as modelo from "@/lib/arbol/modelo";

export type EstadoGuardado = "guardado" | "guardando" | "pendiente" | "error";

export function useArbolEditor(materia: string, tema: string) {
  const [arbol, setArbol] = useState<Arbol | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardado, setGuardado] = useState<EstadoGuardado>("guardado");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeraCarga = useRef(true);

  useEffect(() => {
    fetch(`/api/arboles/${materia}/${tema}`)
      .then(async res => (res.ok ? setArbol(await res.json()) : setNoEncontrado(true)))
      .catch(() => setNoEncontrado(true));
  }, [materia, tema]);

  // Autosave: 800 ms tras el último cambio. Todo el árbol por PUT (simple y robusto).
  useEffect(() => {
    if (!arbol) return;
    if (primeraCarga.current) { primeraCarga.current = false; return; }
    setGuardado("pendiente");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setGuardado("guardando");
      try {
        const res = await fetch(`/api/arboles/${materia}/${tema}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(arbol),
        });
        setGuardado(res.ok ? "guardado" : "error");
      } catch { setGuardado("error"); }
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [arbol, materia, tema]);

  // Mutaciones: envuelven el modelo puro y devuelven datos útiles para la UI.
  const mutar = useCallback((fn: (a: Arbol) => Arbol) => setArbol(a => (a ? fn(a) : a)), []);

  const agregarHijo = useCallback((padreId: string): string | null => {
    let nuevoId: string | null = null;
    setArbol(a => {
      if (!a) return a;
      const r = modelo.agregarHijo(a, padreId);
      nuevoId = r.nodo.id;
      return r.arbol;
    });
    return nuevoId;
  }, []);

  const agregarHermano = useCallback((nodoId: string): string | null => {
    let nuevoId: string | null = null;
    setArbol(a => {
      if (!a) return a;
      const r = modelo.agregarHermano(a, nodoId);
      if (!r) return a;
      nuevoId = r.nodo.id;
      return r.arbol;
    });
    return nuevoId;
  }, []);

  return {
    arbol, noEncontrado, guardado,
    agregarHijo, agregarHermano,
    editarNodo: (id: string, c: modelo.CambiosNodo) => mutar(a => modelo.editarNodo(a, id, c)),
    eliminarNodo: (id: string) => mutar(a => modelo.eliminarNodo(a, id)),
    conectar: (de: string, hasta: string) => mutar(a => modelo.conectar(a, de, hasta)),
    desconectar: (relId: string) => mutar(a => modelo.desconectar(a, relId)),
    reordenar: () => mutar(a => ({ ...a, nodos: a.nodos.map(n => ({ ...n, posicion: null })) })),
  };
}
