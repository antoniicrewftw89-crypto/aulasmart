// scripts/pendientes.ts — CLI headless: ¿qué toca repasar hoy en cada árbol?
// Lo usa Janus (rutina-estudio.ps1) para avisar a Antonio sin abrir la UI,
// fiel a la regla de la casa: un agente opera AulaSmart sin tocar la pantalla.
// Reusa la MISMA lógica que la app (storage + módulos puros) y solo imprime JSON.
//
//   pnpm pendientes            -> [{materia,tema,titulo,pendientesHoy,dominado,total}]
//
import fs from "node:fs";
import path from "node:path";
import { leerArbol, leerMazo, leerProgreso } from "../src/lib/storage/arboles";
import { mazoOEffectivo, type MapaProgreso } from "../src/lib/repaso/tarjetas";
import { resumenRepaso } from "../src/lib/repaso/estadisticas";
import type { Mazo } from "../src/lib/repaso/tipos-tarjeta";

const hoy = new Date().toISOString().slice(0, 10);
const base = process.env.AULASMART_DATA ?? path.join(process.cwd(), "data");
const dirArboles = path.join(base, "arboles");

interface Pendiente {
  materia: string;
  tema: string;
  titulo: string;
  pendientesHoy: number;
  dominado: number;
  total: number;
}

function recolectar(): Pendiente[] {
  if (!fs.existsSync(dirArboles)) return [];
  const out: Pendiente[] = [];
  for (const materia of fs.readdirSync(dirArboles, { withFileTypes: true })) {
    if (!materia.isDirectory()) continue;
    for (const archivo of fs.readdirSync(path.join(dirArboles, materia.name))) {
      if (!archivo.endsWith(".json")) continue;
      if (/\.(repaso|tarjetas)\.json$/.test(archivo)) continue; // material derivado, no es un árbol
      const tema = archivo.replace(/\.json$/, "");
      const arbol = leerArbol(materia.name, tema);
      if (!arbol) continue;
      const mazo = mazoOEffectivo(arbol, leerMazo(materia.name, tema) as Mazo | null);
      const progreso = leerProgreso(materia.name, tema) as MapaProgreso;
      const r = resumenRepaso(arbol, mazo, progreso, hoy);
      out.push({
        materia: arbol.materia, tema, titulo: arbol.titulo,
        pendientesHoy: r.pendientesHoy, dominado: r.dominado, total: r.total,
      });
    }
  }
  return out;
}

const pendientes = recolectar().sort((a, b) => b.pendientesHoy - a.pendientesHoy);
process.stdout.write(JSON.stringify(pendientes));
