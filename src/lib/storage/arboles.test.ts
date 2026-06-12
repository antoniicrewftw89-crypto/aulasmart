import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crearArbol } from "../arbol/modelo";
import { eliminarArbol, guardarArbol, leerArbol, listarArboles, rutaArbol } from "./arboles";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "aulasmart-test-"));
  process.env.AULASMART_DATA = dir;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("storage de árboles", () => {
  it("guarda y lee un árbol idéntico", () => {
    const a = crearArbol("calculo", "limites", "Límites");
    guardarArbol(a);
    expect(leerArbol("calculo", "limites")).toEqual(a);
    expect(fs.existsSync(rutaArbol("calculo", "limites"))).toBe(true);
  });

  it("leerArbol devuelve null si no existe", () => {
    expect(leerArbol("nada", "nada")).toBeNull();
  });

  it("listarArboles resume por materia", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    guardarArbol(crearArbol("algoritmos", "grafos", "Grafos"));
    const lista = listarArboles();
    expect(lista).toHaveLength(2);
    expect(lista.map(r => r.materia).sort()).toEqual(["algoritmos", "calculo"]);
    expect(lista[0].nNodos).toBe(1);
  });

  it("eliminarArbol mueve a la papelera (recuperable)", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    expect(eliminarArbol("calculo", "limites")).toBe(true);
    expect(leerArbol("calculo", "limites")).toBeNull();
    const papelera = path.join(dir, ".papelera");
    expect(fs.readdirSync(papelera).length).toBe(1);
  });

  it("un JSON corrupto no tumba el listado: se renombra a .broken", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    fs.writeFileSync(rutaArbol("calculo", "limites"), "{ basura");
    expect(listarArboles()).toHaveLength(0);
    const archivos = fs.readdirSync(path.join(dir, "arboles", "calculo"));
    expect(archivos.some(f => f.includes(".broken-"))).toBe(true);
  });

  it("data/ queda como repo git con commits", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
  });
});
