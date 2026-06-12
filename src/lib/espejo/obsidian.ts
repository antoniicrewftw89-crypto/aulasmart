// obsidian.ts — Espejo unidireccional AulaSmart → bóveda. SOLO servidor.
// Nunca lanza: si la bóveda no está, la app sigue funcionando igual.
import fs from "node:fs";
import path from "node:path";
import type { Arbol } from "../arbol/types";
import { generarOutlineMd } from "./markdown";

const RUTA_BOVEDA = () => process.env.OBSIDIAN_VAULT_PATH ?? "C:\\Workspace\\synapse-vault";
const CARPETA_ESTUDIO = "05_Estudio";

export function espejarArbol(a: Arbol, boveda: string = RUTA_BOVEDA()): boolean {
  try {
    if (!fs.existsSync(boveda)) return false; // bóveda apagada/movida: no inventar rutas
    const dir = path.join(boveda, CARPETA_ESTUDIO, a.materia);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${a.tema}.md`), generarOutlineMd(a), "utf8");
    return true;
  } catch { return false; }
}

/** Espeja un artefacto generado (p. ej. {tema}.guion.md) en la bóveda. */
export function espejarArtefacto(
  materia: string, nombreArchivo: string, contenido: string, boveda: string = RUTA_BOVEDA(),
): boolean {
  try {
    if (!fs.existsSync(boveda)) return false;
    const dir = path.join(boveda, CARPETA_ESTUDIO, materia);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, nombreArchivo), contenido, "utf8");
    return true;
  } catch { return false; }
}

export function borrarEspejo(materia: string, tema: string, boveda: string = RUTA_BOVEDA()): boolean {
  try {
    const ruta = path.join(boveda, CARPETA_ESTUDIO, materia, `${tema}.md`);
    if (!fs.existsSync(ruta)) return false;
    fs.unlinkSync(ruta);
    limpiarCarpetaVacia(path.dirname(ruta));
    return true;
  } catch { return false; }
}

// Al mover/borrar, que no queden carpetas fantasma en la bóveda
function limpiarCarpetaVacia(dir: string): void {
  try { if (!fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch { /* ocupada o ya no está */ }
}

/** Quita un artefacto espejado (p. ej. al mover el árbol de materia). */
export function borrarArtefactoEspejo(materia: string, nombreArchivo: string, boveda: string = RUTA_BOVEDA()): boolean {
  try {
    const ruta = path.join(boveda, CARPETA_ESTUDIO, materia, nombreArchivo);
    if (!fs.existsSync(ruta)) return false;
    fs.unlinkSync(ruta);
    limpiarCarpetaVacia(path.dirname(ruta));
    return true;
  } catch { return false; }
}
