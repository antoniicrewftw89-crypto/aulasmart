// texto.ts — Utilidades de texto para la ingesta.
// `recortar` es PURO (testeable sin red). La extracción de PDF vive en pdf.ts
// (usa unpdf, solo servidor) para que este módulo no arrastre la dependencia.
export const MAX_INGESTA = 16000; // ~varias páginas; cabe en los modelos gratuitos

/** Recorta el material a `max` caracteres, avisando si hubo que cortar. */
export function recortar(texto: string, max: number = MAX_INGESTA): { texto: string; recortado: boolean } {
  const limpio = texto.trim();
  if (limpio.length <= max) return { texto: limpio, recortado: false };
  return { texto: limpio.slice(0, max), recortado: true };
}
