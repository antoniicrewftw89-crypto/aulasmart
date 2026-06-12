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
