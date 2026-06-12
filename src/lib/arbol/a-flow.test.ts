import { describe, expect, it } from "vitest";
import { agregarHijo, conectar, crearArbol, editarNodo, raizDe } from "./modelo";
import { aFlow } from "./a-flow";

describe("aFlow", () => {
  const arma = () => {
    const a0 = crearArbol("calculo", "limites", "Límites");
    const { arbol: a1, nodo: h1 } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2, nodo: h2 } = agregarHijo(a1, raizDe(a1).id, "continuidad");
    return { a: conectar(a2, h1.id, h2.id, "se usa en"), h1, h2 };
  };

  it("genera un node por nodo y aristas jerárquicas + cruzadas", () => {
    const { a } = arma();
    const { nodes, edges } = aFlow(a);
    expect(nodes).toHaveLength(3);
    expect(edges.filter(e => e.id.startsWith("j-"))).toHaveLength(2);
    expect(edges.filter(e => e.id.startsWith("r-"))).toHaveLength(1);
  });

  it("el layout posiciona sin solapar y respeta posiciones manuales", () => {
    const { a, h1 } = arma();
    const fijado = editarNodo(a, h1.id, { posicion: { x: 999, y: 111 } });
    const { nodes } = aFlow(fijado);
    const fijo = nodes.find(n => n.id === h1.id)!;
    expect(fijo.position).toEqual({ x: 999, y: 111 });
    const resto = nodes.filter(n => n.id !== h1.id);
    expect(new Set(resto.map(n => `${n.position.x},${n.position.y}`)).size).toBe(resto.length);
  });
});
