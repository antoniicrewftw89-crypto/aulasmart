import { describe, expect, it } from "vitest";
import { agregarHijo, crearArbol, raizDe } from "../arbol/modelo";
import { aplicarConexiones } from "./conexiones";

// Árbol: N1=raíz "Cálculo", N2="Derivadas", N3="Límites" (hermanos bajo la raíz).
function arbolDemo() {
  const a0 = crearArbol("calculo", "x", "Cálculo");
  const { arbol: a1 } = agregarHijo(a0, raizDe(a0).id, "Derivadas");
  const { arbol: a2 } = agregarHijo(a1, raizDe(a1).id, "Límites");
  return a2;
}

describe("aplicarConexiones", () => {
  it("conecta dos nodos no emparentados por su código", () => {
    const a = arbolDemo();
    const out = aplicarConexiones(a, [{ desde: "N2", hasta: "N3", etiqueta: "se define con" }]);
    expect(out.relaciones).toHaveLength(1);
    expect(out.relaciones[0].etiqueta).toBe("se define con");
  });

  it("ignora padre-hijo y códigos inexistentes (conectar valida)", () => {
    const a = arbolDemo();
    const out = aplicarConexiones(a, [
      { desde: "N1", hasta: "N2", etiqueta: "x" }, // raíz→hijo: rechazado
      { desde: "N9", hasta: "N3", etiqueta: "y" }, // código inexistente: ignorado
    ]);
    expect(out.relaciones).toHaveLength(0);
  });

  it("no duplica la misma conexión", () => {
    const a = arbolDemo();
    const out = aplicarConexiones(a, [
      { desde: "N2", hasta: "N3", etiqueta: "a" },
      { desde: "N3", hasta: "N2", etiqueta: "b" }, // misma pareja invertida
    ]);
    expect(out.relaciones).toHaveLength(1);
  });
});
