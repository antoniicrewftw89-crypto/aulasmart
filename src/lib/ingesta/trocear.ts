// trocear.ts — Parte un texto largo en trozos solapados para ingerirlo por
// partes cuando no cabe en una sola llamada (camino Groq, sin contexto 1M).
// PURO. Corta preferiblemente en límites de párrafo/oración para no romper ideas.

export interface OpcionesTroceo {
  maxChars?: number;
  solapeChars?: number;
}

const POR_DEFECTO = { maxChars: 6000, solapeChars: 400 };

export function trocear(texto: string, opciones: OpcionesTroceo = {}): string[] {
  const max = opciones.maxChars ?? POR_DEFECTO.maxChars;
  const solape = Math.min(opciones.solapeChars ?? POR_DEFECTO.solapeChars, Math.floor(max / 2));
  const limpio = texto.trim();
  if (limpio.length <= max) return limpio ? [limpio] : [];

  const trozos: string[] = [];
  let i = 0;
  while (i < limpio.length) {
    let fin = Math.min(i + max, limpio.length);
    if (fin < limpio.length) {
      // Cortar en el último salto de párrafo/oración del trozo (si está pasada la mitad).
      const ventana = limpio.slice(i, fin);
      const corte = Math.max(ventana.lastIndexOf("\n\n"), ventana.lastIndexOf("\n"), ventana.lastIndexOf(". "));
      if (corte > max * 0.5) fin = i + corte + 1;
    }
    trozos.push(limpio.slice(i, fin).trim());
    if (fin >= limpio.length) break;
    i = Math.max(fin - solape, i + 1); // avanza con solape, nunca se queda parado
  }
  return trozos.filter(Boolean);
}
