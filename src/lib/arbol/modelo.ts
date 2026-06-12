// modelo.ts — Mutaciones puras: cada función devuelve un Árbol NUEVO.
// La IA jamás llama a esto por su cuenta: solo la UI/API a petición del humano.
import type { Arbol, EstadoNodo, NodoArbol } from "./types";

export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const ahora = () => new Date().toISOString();
const tocar = (a: Arbol): Arbol => ({ ...a, actualizadoEn: ahora() });

export function crearArbol(materia: string, tema: string, titulo: string): Arbol {
  const raiz: NodoArbol = {
    id: nuevoId(), texto: titulo, notas: "", fuentes: [], estado: "borrador",
    color: null, etiquetas: [], posicion: null, padreId: null, orden: 0,
  };
  const t = ahora();
  return { version: 1, materia, tema, titulo, nodos: [raiz], relaciones: [], creadoEn: t, actualizadoEn: t };
}

export const raizDe = (a: Arbol): NodoArbol => a.nodos.find(n => n.padreId === null)!;

export const hijosDe = (a: Arbol, id: string): NodoArbol[] =>
  a.nodos.filter(n => n.padreId === id).sort((x, y) => x.orden - y.orden);

export function descendientesDe(a: Arbol, id: string): string[] {
  const directos = a.nodos.filter(n => n.padreId === id).map(n => n.id);
  return directos.flatMap(d => [d, ...descendientesDe(a, d)]);
}

export function agregarHijo(a: Arbol, padreId: string, texto = ""): { arbol: Arbol; nodo: NodoArbol } {
  const hermanos = hijosDe(a, padreId);
  const nodo: NodoArbol = {
    id: nuevoId(), texto, notas: "", fuentes: [], estado: "borrador",
    color: null, etiquetas: [], posicion: null, padreId,
    orden: hermanos.length ? hermanos[hermanos.length - 1].orden + 1 : 0,
  };
  return { arbol: tocar({ ...a, nodos: [...a.nodos, nodo] }), nodo };
}

export function agregarHermano(a: Arbol, nodoId: string, texto = ""): { arbol: Arbol; nodo: NodoArbol } | null {
  const ref = a.nodos.find(n => n.id === nodoId);
  if (!ref || ref.padreId === null) return null; // la raíz no tiene hermanos
  const nodo: NodoArbol = {
    id: nuevoId(), texto, notas: "", fuentes: [], estado: "borrador",
    color: null, etiquetas: [], posicion: null, padreId: ref.padreId, orden: ref.orden + 0.5,
  };
  // renormalizar el orden de los hermanos a enteros
  const conNuevo = tocar({ ...a, nodos: [...a.nodos, nodo] });
  const renum = hijosDe(conNuevo, ref.padreId).map((n, i) => ({ ...n, orden: i }));
  const arbol = { ...conNuevo, nodos: conNuevo.nodos.map(n => renum.find(r => r.id === n.id) ?? n) };
  return { arbol, nodo: renum.find(r => r.id === nodo.id) ?? nodo };
}

export type CambiosNodo = Partial<Pick<NodoArbol, "texto" | "notas" | "fuentes" | "estado" | "color" | "etiquetas" | "posicion">>;

export function editarNodo(a: Arbol, id: string, cambios: CambiosNodo): Arbol {
  const nodo = a.nodos.find(n => n.id === id);
  if (!nodo) return a;
  // El texto de la raíz ES el título del árbol: renombrar el sticky central
  // renombra el lienzo (así el lienzo "se va haciendo" mientras trabajas).
  const titulo = nodo.padreId === null && cambios.texto !== undefined ? cambios.texto : a.titulo;
  return tocar({ ...a, titulo, nodos: a.nodos.map(n => (n.id === id ? { ...n, ...cambios } : n)) });
}

export function eliminarNodo(a: Arbol, id: string): Arbol {
  const nodo = a.nodos.find(n => n.id === id);
  if (!nodo || nodo.padreId === null) return a; // la raíz no se borra
  const fuera = new Set([id, ...descendientesDe(a, id)]);
  return tocar({
    ...a,
    nodos: a.nodos.filter(n => !fuera.has(n.id)),
    relaciones: a.relaciones.filter(r => !fuera.has(r.desdeId) && !fuera.has(r.hastaId)),
  });
}

export function moverNodo(a: Arbol, id: string, nuevoPadreId: string): Arbol {
  const nodo = a.nodos.find(n => n.id === id);
  if (!nodo || nodo.padreId === null || id === nuevoPadreId) return a;
  if (!a.nodos.some(n => n.id === nuevoPadreId)) return a;
  if (descendientesDe(a, id).includes(nuevoPadreId)) return a; // evitaría un ciclo
  const hermanos = hijosDe(a, nuevoPadreId);
  const orden = hermanos.length ? hermanos[hermanos.length - 1].orden + 1 : 0;
  return tocar({ ...a, nodos: a.nodos.map(n => (n.id === id ? { ...n, padreId: nuevoPadreId, orden } : n)) });
}

export function conectar(a: Arbol, desdeId: string, hastaId: string, etiqueta = ""): Arbol {
  if (desdeId === hastaId) return a;
  const existen = new Set(a.nodos.map(n => n.id));
  if (!existen.has(desdeId) || !existen.has(hastaId)) return a;
  const hasta = a.nodos.find(n => n.id === hastaId)!;
  const desde = a.nodos.find(n => n.id === desdeId)!;
  if (hasta.padreId === desdeId || desde.padreId === hastaId) return a; // ya unidos por jerarquía
  if (a.relaciones.some(r => (r.desdeId === desdeId && r.hastaId === hastaId) || (r.desdeId === hastaId && r.hastaId === desdeId))) return a;
  return tocar({ ...a, relaciones: [...a.relaciones, { id: nuevoId(), desdeId, hastaId, etiqueta }] });
}

export const desconectar = (a: Arbol, relId: string): Arbol =>
  tocar({ ...a, relaciones: a.relaciones.filter(r => r.id !== relId) });

/** Devuelve la lista de problemas; árbol sano = []. */
export function validarArbol(a: Arbol): string[] {
  const errores: string[] = [];
  if (a.version !== 1) errores.push("versión desconocida");
  const raices = a.nodos.filter(n => n.padreId === null);
  if (raices.length !== 1) errores.push(`debe haber exactamente 1 raíz (hay ${raices.length})`);
  const ids = new Set(a.nodos.map(n => n.id));
  if (ids.size !== a.nodos.length) errores.push("ids de nodo duplicados");
  for (const n of a.nodos)
    if (n.padreId !== null && !ids.has(n.padreId)) errores.push(`nodo ${n.id} huérfano (padre ${n.padreId} no existe)`);
  for (const r of a.relaciones)
    if (!ids.has(r.desdeId) || !ids.has(r.hastaId)) errores.push(`relación ${r.id} apunta a nodos inexistentes`);
  const estados: EstadoNodo[] = ["borrador", "verificado", "dudoso"];
  for (const n of a.nodos) if (!estados.includes(n.estado)) errores.push(`estado inválido en ${n.id}`);
  return errores;
}
