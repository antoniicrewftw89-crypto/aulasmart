import { describe, expect, it } from "vitest";
import {
  agregarHermano, agregarHijo, conectar, crearArbol, descendientesDe,
  desconectar, editarNodo, eliminarNodo, hijosDe, moverNodo, raizDe, validarArbol,
} from "./modelo";

const base = () => crearArbol("calculo", "limites", "Límites");

describe("modelo del árbol", () => {
  it("crearArbol crea raíz única con el título", () => {
    const a = base();
    const raiz = raizDe(a);
    expect(raiz.texto).toBe("Límites");
    expect(raiz.padreId).toBeNull();
    expect(a.nodos).toHaveLength(1);
    expect(validarArbol(a)).toEqual([]);
  });

  it("agregarHijo cuelga del padre con orden incremental", () => {
    const a0 = base();
    const { arbol: a1, nodo: h1 } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2, nodo: h2 } = agregarHijo(a1, raizDe(a1).id, "propiedades");
    expect(hijosDe(a2, raizDe(a2).id).map(n => n.texto)).toEqual(["definición", "propiedades"]);
    expect(h2.orden).toBeGreaterThan(h1.orden);
  });

  it("agregarHermano inserta tras el nodo de referencia; raíz devuelve null", () => {
    const a0 = base();
    expect(agregarHermano(a0, raizDe(a0).id)).toBeNull();
    const { arbol: a1, nodo: h1 } = agregarHijo(a0, raizDe(a0).id, "uno");
    const { arbol: a2 } = agregarHijo(a1, raizDe(a1).id, "tres");
    const r = agregarHermano(a2, h1.id, "dos");
    expect(r).not.toBeNull();
    expect(hijosDe(r!.arbol, raizDe(r!.arbol).id).map(n => n.texto)).toEqual(["uno", "dos", "tres"]);
  });

  it("eliminarNodo borra descendientes y relaciones colgantes; raíz prohibida", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    const { arbol: a2, nodo: n } = agregarHijo(a1, h.id, "nieto");
    const a3 = conectar(a2, n.id, raizDe(a2).id, "ver");
    const a4 = eliminarNodo(a3, h.id);
    expect(a4.nodos).toHaveLength(1);
    expect(a4.relaciones).toHaveLength(0);
    expect(eliminarNodo(a4, raizDe(a4).id)).toBe(a4); // no-op
  });

  it("moverNodo rechaza moverse a un descendiente propio", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    const { arbol: a2, nodo: n } = agregarHijo(a1, h.id, "nieto");
    expect(moverNodo(a2, h.id, n.id)).toBe(a2); // no-op
    const { arbol: a3, nodo: h2 } = agregarHijo(a2, raizDe(a2).id, "h2");
    const a4 = moverNodo(a3, n.id, h2.id);
    expect(a4.nodos.find(x => x.id === n.id)!.padreId).toBe(h2.id);
  });

  it("conectar evita duplicados, self-loops y duplicar la jerarquía", () => {
    const a0 = base();
    const { arbol: a1, nodo: h1 } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2, nodo: h2 } = agregarHijo(a1, raizDe(a1).id, "continuidad");
    expect(conectar(a2, h1.id, h1.id)).toBe(a2);                  // self
    expect(conectar(a2, raizDe(a2).id, h1.id)).toBe(a2);          // ya es arista jerárquica
    expect(conectar(a2, h1.id, raizDe(a2).id)).toBe(a2);          // jerárquica invertida: también redundante
    const a3 = conectar(a2, h1.id, h2.id, "se usa en");           // hermanos: la relación cruzada real
    expect(a3.relaciones).toHaveLength(1);
    expect(conectar(a3, h2.id, h1.id)).toBe(a3);                  // duplicada (da igual el sentido)
    expect(desconectar(a3, a3.relaciones[0].id).relaciones).toHaveLength(0);
  });

  it("editarNodo cambia campos", () => {
    const a = base();
    const id = raizDe(a).id;
    const a2 = editarNodo(a, id, { estado: "verificado", notas: "ok" });
    expect(a2.nodos[0].estado).toBe("verificado");
    expect(a2.nodos[0].notas).toBe("ok");
  });

  it("renombrar la raíz renombra el árbol (el lienzo se hace mientras se trabaja)", () => {
    const a = base();
    const a2 = editarNodo(a, raizDe(a).id, { texto: "Límites y continuidad" });
    expect(a2.titulo).toBe("Límites y continuidad");
    const a0 = base();
    const { arbol: a3, nodo: h } = agregarHijo(a0, raizDe(a0).id, "hijo");
    expect(editarNodo(a3, h.id, { texto: "otro" }).titulo).toBe("Límites"); // un hijo no renombra
  });

  it("validarArbol detecta huérfanos y multi-raíz", () => {
    const a = base();
    const roto = { ...a, nodos: [...a.nodos, { ...a.nodos[0], id: "x", padreId: "no-existe" }] };
    expect(validarArbol(roto).length).toBeGreaterThan(0);
  });

  it("descendientesDe devuelve todos los niveles", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    const { arbol: a2, nodo: n } = agregarHijo(a1, h.id, "nieto");
    expect(descendientesDe(a2, raizDe(a2).id).sort()).toEqual([h.id, n.id].sort());
  });
});
