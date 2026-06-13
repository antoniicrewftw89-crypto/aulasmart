// leitner.ts — Repaso espaciado por cajas (sistema Leitner). PURO.
// Cada tarjeta vive en una caja; aciertos la suben (repasos más espaciados),
// fallos la devuelven a la caja 1. Nada de IA: es pura aritmética de fechas.

// Días hasta el próximo repaso según la caja (1→5). Intervalos clásicos.
export const INTERVALOS_DIAS = [1, 2, 4, 7, 15] as const;

export interface ProgresoNodo {
  caja: number;          // 1..5
  proximoRepaso: string; // YYYY-MM-DD
  aciertos: number;
  fallos: number;
}

// Suma días a una fecha YYYY-MM-DD sin arrastrar zona horaria (UTC puro).
function sumarDias(fechaIso: string, dias: number): string {
  const d = new Date(`${fechaIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const intervaloDe = (caja: number): number => INTERVALOS_DIAS[Math.min(caja, INTERVALOS_DIAS.length) - 1];

export function estadoInicial(hoy: string): ProgresoNodo {
  return { caja: 1, proximoRepaso: hoy, aciertos: 0, fallos: 0 };
}

export function registrarResultado(p: ProgresoNodo, acierto: boolean, hoy: string): ProgresoNodo {
  if (acierto) {
    const caja = Math.min(p.caja + 1, INTERVALOS_DIAS.length);
    return { caja, proximoRepaso: sumarDias(hoy, intervaloDe(caja)), aciertos: p.aciertos + 1, fallos: p.fallos };
  }
  // Fallo: vuelta al principio, repaso al día siguiente.
  return { caja: 1, proximoRepaso: sumarDias(hoy, 1), aciertos: p.aciertos, fallos: p.fallos + 1 };
}

export const tocaHoy = (p: ProgresoNodo, hoy: string): boolean => p.proximoRepaso <= hoy;
