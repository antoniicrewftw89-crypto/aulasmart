import { describe, expect, it } from "vitest";
import {
  INTERVALOS_DIAS,
  estadoInicial,
  registrarResultado,
  tocaHoy,
  type ProgresoNodo,
} from "./leitner";

const HOY = "2026-06-12";

describe("estadoInicial", () => {
  it("un nodo nuevo entra en caja 1 y toca hoy", () => {
    const p = estadoInicial(HOY);
    expect(p.caja).toBe(1);
    expect(p.proximoRepaso).toBe(HOY);
    expect(p.aciertos).toBe(0);
  });
});

describe("registrarResultado", () => {
  it("acertar sube de caja y aleja el próximo repaso según el intervalo", () => {
    const p0 = estadoInicial(HOY);
    const p1 = registrarResultado(p0, true, HOY);
    expect(p1.caja).toBe(2);
    expect(p1.aciertos).toBe(1);
    // caja 2 → INTERVALOS_DIAS[1] días después
    expect(p1.proximoRepaso).toBe("2026-06-14"); // +2 días
  });

  it("la caja no pasa del máximo (5)", () => {
    let p = estadoInicial(HOY);
    for (let i = 0; i < 10; i++) p = registrarResultado(p, true, HOY);
    expect(p.caja).toBe(INTERVALOS_DIAS.length); // 5
  });

  it("fallar devuelve a la caja 1 y repaso mañana", () => {
    let p = estadoInicial(HOY);
    p = registrarResultado(p, true, HOY); // caja 2
    p = registrarResultado(p, true, HOY); // caja 3
    const fallo = registrarResultado(p, false, HOY);
    expect(fallo.caja).toBe(1);
    expect(fallo.proximoRepaso).toBe("2026-06-13"); // +1 día
    expect(fallo.fallos).toBe(1);
  });
});

describe("tocaHoy", () => {
  it("toca si el próximo repaso es hoy o ya pasó", () => {
    const vencida: ProgresoNodo = { caja: 2, proximoRepaso: "2026-06-10", aciertos: 1, fallos: 0 };
    const hoy: ProgresoNodo = { caja: 1, proximoRepaso: HOY, aciertos: 0, fallos: 0 };
    const futura: ProgresoNodo = { caja: 3, proximoRepaso: "2026-06-20", aciertos: 2, fallos: 0 };
    expect(tocaHoy(vencida, HOY)).toBe(true);
    expect(tocaHoy(hoy, HOY)).toBe(true);
    expect(tocaHoy(futura, HOY)).toBe(false);
  });
});
