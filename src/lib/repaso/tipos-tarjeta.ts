// tipos-tarjeta.ts — El modelo de tarjeta del mazo. Dos formatos en la Capa 1:
// "voltear" (concepto → explicación) y "opcion" (pregunta de opción múltiple).
// Un mazo es la lista de tarjetas de un árbol, persistida aparte del progreso.

export interface TarjetaVoltear {
  nodoId: string;
  tipo: "voltear";
  anverso: string;   // la idea / pregunta corta
  reverso: string;   // la explicación
}

export interface TarjetaOpcion {
  nodoId: string;
  tipo: "opcion";
  pregunta: string;
  opciones: string[];  // siempre 4
  correcta: number;    // índice 0..3 de la opción correcta
  explica: string;     // por qué (se muestra tras responder)
}

export type Tarjeta = TarjetaVoltear | TarjetaOpcion;
export type Mazo = Tarjeta[];

/** Valida que una tarjeta de opción esté bien formada (4 opciones, índice válido). */
export function opcionValida(t: TarjetaOpcion): boolean {
  return t.opciones.length === 4
    && Number.isInteger(t.correcta) && t.correcta >= 0 && t.correcta < 4
    && t.opciones.every(o => o.trim().length > 0);
}
