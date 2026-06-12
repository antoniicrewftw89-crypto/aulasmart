// arboles.ts — Persistencia local-first. SOLO servidor (usa fs).
// Reglas: escritura atómica (tmp+rename), borrado = papelera, cada guardado
// queda commiteado en el repo git de data/ (las "versiones" del mindmap).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Arbol, ResumenArbol } from "../arbol/types";

const base = () => process.env.AULASMART_DATA ?? path.join(process.cwd(), "data");
const dirArboles = () => path.join(base(), "arboles");

export const rutaArbol = (materia: string, tema: string) =>
  path.join(dirArboles(), materia, `${tema}.json`);

function git(args: string[]): void {
  // Nunca dejar que git tumbe un guardado: el commit es mejora, no requisito.
  try {
    execFileSync("git", ["-c", "user.name=AulaSmart", "-c", "user.email=aulasmart@local", ...args], {
      cwd: base(), stdio: "ignore",
    });
  } catch { /* sin git o sin cambios: seguir */ }
}

function asegurarRepo(): void {
  fs.mkdirSync(dirArboles(), { recursive: true });
  if (!fs.existsSync(path.join(base(), ".git"))) git(["init"]);
}

export function guardarArbol(a: Arbol): void {
  asegurarRepo();
  const destino = rutaArbol(a.materia, a.tema);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(a, null, 2), "utf8");
  fs.renameSync(tmp, destino); // atómico: o está el viejo o el nuevo, jamás a medias
  git(["add", "-A"]);
  git(["commit", "-m", `autosave: ${a.materia}/${a.tema}`, "--quiet"]);
}

export function leerArbol(materia: string, tema: string): Arbol | null {
  const ruta = rutaArbol(materia, tema);
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as Arbol;
  } catch {
    // JSON corrupto: apartarlo con timestamp, no sobreescribir jamás
    fs.renameSync(ruta, `${ruta}.broken-${Date.now()}`);
    return null;
  }
}

export function listarArboles(): ResumenArbol[] {
  if (!fs.existsSync(dirArboles())) return [];
  const resumen: ResumenArbol[] = [];
  for (const materia of fs.readdirSync(dirArboles(), { withFileTypes: true })) {
    if (!materia.isDirectory()) continue;
    for (const archivo of fs.readdirSync(path.join(dirArboles(), materia.name))) {
      if (!archivo.endsWith(".json")) continue;
      const a = leerArbol(materia.name, archivo.replace(/\.json$/, ""));
      if (a) resumen.push({ materia: a.materia, tema: a.tema, titulo: a.titulo, nNodos: a.nodos.length, actualizadoEn: a.actualizadoEn });
    }
  }
  return resumen.sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn));
}

/** Guarda un artefacto generado (guion/quiz/slides) junto a su árbol. */
export function guardarArtefacto(materia: string, tema: string, sufijo: string, contenido: string): string {
  asegurarRepo();
  const destino = path.join(dirArboles(), materia, `${tema}.${sufijo}`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contenido, "utf8");
  fs.renameSync(tmp, destino);
  git(["add", "-A"]);
  git(["commit", "-m", `artefacto: ${materia}/${tema}.${sufijo}`, "--quiet"]);
  return destino;
}

/** Lee un artefacto generado, o null si no existe. */
export function leerArtefacto(materia: string, tema: string, sufijo: string): string | null {
  const ruta = path.join(dirArboles(), materia, `${tema}.${sufijo}`);
  return fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8") : null;
}

/**
 * Cambia la materia de un árbol: mueve el JSON y sus artefactos hermanos
 * ({tema}.guion.md, etc.) a la carpeta nueva. Null si no existe o hay conflicto.
 */
export function moverArbol(materia: string, tema: string, nuevaMateria: string): Arbol | null {
  const a = leerArbol(materia, tema);
  if (!a) return null;
  if (nuevaMateria === materia) return a;
  if (fs.existsSync(rutaArbol(nuevaMateria, tema))) return null; // ya hay un lienzo con ese nombre allí

  const actualizado: Arbol = { ...a, materia: nuevaMateria, actualizadoEn: new Date().toISOString() };
  guardarArbol(actualizado); // escribe la copia nueva (atómica)

  const dirViejo = path.join(dirArboles(), materia);
  fs.rmSync(rutaArbol(materia, tema));
  for (const f of fs.readdirSync(dirViejo)) {
    if (f.startsWith(`${tema}.`)) {
      fs.renameSync(path.join(dirViejo, f), path.join(dirArboles(), nuevaMateria, f));
    }
  }
  if (!fs.readdirSync(dirViejo).length) fs.rmdirSync(dirViejo); // sin carpetas fantasma
  git(["add", "-A"]);
  git(["commit", "-m", `mover: ${materia}/${tema} -> ${nuevaMateria}/${tema}`, "--quiet"]);
  return actualizado;
}

export function eliminarArbol(materia: string, tema: string): boolean {
  const ruta = rutaArbol(materia, tema);
  if (!fs.existsSync(ruta)) return false;
  const papelera = path.join(base(), ".papelera");
  fs.mkdirSync(papelera, { recursive: true });
  fs.renameSync(ruta, path.join(papelera, `${materia}--${tema}--${Date.now()}.json`));
  git(["add", "-A"]);
  git(["commit", "-m", `papelera: ${materia}/${tema}`, "--quiet"]);
  return true;
}
