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

export function borrarEspejo(materia: string, tema: string, boveda: string = RUTA_BOVEDA()): boolean {
  try {
    const ruta = path.join(boveda, CARPETA_ESTUDIO, materia, `${tema}.md`);
    if (!fs.existsSync(ruta)) return false;
    fs.unlinkSync(ruta);
    return true;
  } catch { return false; }
}
