// types.ts — El dominio completo de AulaSmart F0.
export type EstadoNodo = "borrador" | "verificado" | "dudoso";

export interface NodoArbol {
  id: string;
  texto: string;
  notas: string;
  fuentes: string[];
  estado: EstadoNodo;
  color: string | null;       // hex de la paleta, null = neutro
  etiquetas: string[];
  posicion: { x: number; y: number } | null; // null = la decide el auto-layout
  padreId: string | null;     // null SOLO en la raíz
  orden: number;              // orden entre hermanos
}

export interface RelacionCruzada {
  id: string;
  desdeId: string;
  hastaId: string;
  etiqueta: string;
}

export interface Arbol {
  version: 1;
  materia: string;  // slug
  tema: string;     // slug
  titulo: string;   // texto visible
  nodos: NodoArbol[];
  relaciones: RelacionCruzada[];
  creadoEn: string;      // ISO
  actualizadoEn: string; // ISO
}

export interface ResumenArbol {
  materia: string;
  tema: string;
  titulo: string;
  nNodos: number;
  actualizadoEn: string;
}
