import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crearArbol } from "../arbol/modelo";
import { borrarEspejo, espejarArbol } from "./obsidian";

let vault: string;
beforeEach(() => { vault = fs.mkdtempSync(path.join(os.tmpdir(), "vault-test-")); });
afterEach(() => fs.rmSync(vault, { recursive: true, force: true }));

describe("espejo Obsidian", () => {
  it("escribe el outline en 05_Estudio/{materia}/{tema}.md", () => {
    const ok = espejarArbol(crearArbol("calculo", "limites", "Límites"), vault);
    expect(ok).toBe(true);
    const ruta = path.join(vault, "05_Estudio", "calculo", "limites.md");
    expect(fs.readFileSync(ruta, "utf8")).toContain("origen: aulasmart");
  });

  it("si la bóveda no existe, no inventa carpetas y devuelve false", () => {
    expect(espejarArbol(crearArbol("c", "t", "T"), path.join(vault, "no-existe"))).toBe(false);
  });

  it("borrarEspejo quita el archivo y tolera que no exista", () => {
    espejarArbol(crearArbol("calculo", "limites", "Límites"), vault);
    expect(borrarEspejo("calculo", "limites", vault)).toBe(true);
    expect(borrarEspejo("calculo", "limites", vault)).toBe(false);
  });
});
