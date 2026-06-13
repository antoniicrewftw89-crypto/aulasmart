// estructurar.ts — Orquesta la llamada a la IA para sacar el outline del material
// (parte SERVIDOR). Elige el camino por TAMAÑO y CLAVES disponibles, según el
// plan multi-modelo:
//   · cabe / proveedor concreto → una sola llamada (router normal),
//   · grande + Gemini → una llamada con su contexto ~1M (sin trocear),
//   · grande + solo Groq → trocear → estructurar cada trozo → fusionar.
// Compone piezas puras ya testeadas (trocear, fusionarOutlines).
import { generateObject, type LanguageModel } from "ai";
import { conRouter, modeloParaTarea, tieneClave, type EleccionProveedor } from "../ia/proveedores";
import { EsquemaIngesta, construirPromptIngesta, type Outline } from "./esquema";
import { trocear } from "./trocear";
import { fusionarOutlines } from "./fusionar-outline";

const UMBRAL_GRANDE = 14000; // chars; por encima se trata como "documento grande"
const MAX_TROZOS = 40;       // tope de trozos por ingesta (camino Groq)

async function estructurarTrozo(model: LanguageModel, material: string): Promise<Outline> {
  const { system, prompt } = construirPromptIngesta(material);
  const { object } = await generateObject({ model, schema: EsquemaIngesta, system, prompt });
  return object;
}

// Reintenta solo ante rate-limit (429): backoff lineal. Otros errores se lanzan.
async function conReintentos<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  let ultimo: unknown;
  for (let k = 0; k < intentos; k++) {
    try { return await fn(); }
    catch (e) {
      ultimo = e;
      const msg = String(e).toLowerCase();
      const esRate = msg.includes("rate") || msg.includes("429") || msg.includes("too many");
      if (!esRate || k === intentos - 1) throw e;
      await new Promise(r => setTimeout(r, 2500 * (k + 1)));
    }
  }
  throw ultimo;
}

export interface ResultadoEstructura {
  outline: Outline;
  proveedor: string;
  trozos: number;
  recortado: boolean; // true si el doc era tan largo que se procesó solo el inicio
}

export async function estructurarMaterial(texto: string, eleccion: EleccionProveedor): Promise<ResultadoEstructura> {
  // Cabe, o el usuario eligió un proveedor concreto → una sola llamada.
  if (texto.length <= UMBRAL_GRANDE || eleccion !== "auto") {
    const { resultado, proveedor } = await conRouter(eleccion, m => estructurarTrozo(m, texto));
    return { outline: resultado, proveedor, trozos: 1, recortado: false };
  }
  // Grande + Gemini disponible → una llamada con su contexto gigante (sin trocear).
  if (tieneClave("gemini")) {
    const elegido = modeloParaTarea("ingerir-grande");
    if (elegido) {
      const outline = await estructurarTrozo(elegido.model, texto);
      return { outline, proveedor: elegido.proveedor, trozos: 1, recortado: false };
    }
  }
  // Grande + solo Groq → trocear, estructurar cada trozo (con reintentos) y fusionar.
  const todos = trocear(texto);
  const recortado = todos.length > MAX_TROZOS;
  const trozos = todos.slice(0, MAX_TROZOS);
  const outlines: Outline[] = [];
  let proveedor = "groq";
  for (const trozo of trozos) {
    const { resultado, proveedor: p } = await conReintentos(() => conRouter("auto", m => estructurarTrozo(m, trozo)));
    outlines.push(resultado);
    proveedor = p;
  }
  return { outline: fusionarOutlines(outlines), proveedor, trozos: trozos.length, recortado };
}
