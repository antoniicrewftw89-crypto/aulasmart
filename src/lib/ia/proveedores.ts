// proveedores.ts — Router multimodelo gratis-first. SOLO servidor.
// Regla de oro del spec: Claude (pago) JAMÁS responde por fallback;
// solo cuando el humano lo elige explícitamente.
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type IdProveedor = "groq" | "gemini" | "claude";
export type EleccionProveedor = "auto" | IdProveedor;

const MODELOS: Record<IdProveedor, () => string> = {
  groq: () => process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  gemini: () => process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  claude: () => process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
};

function clave(id: IdProveedor): string | undefined {
  if (id === "groq") return process.env.GROQ_API_KEY;
  if (id === "gemini") return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return process.env.ANTHROPIC_API_KEY;
}

export function modeloPara(id: IdProveedor): LanguageModel | null {
  const k = clave(id);
  if (!k) return null;
  if (id === "groq") return createGroq({ apiKey: k })(MODELOS.groq());
  if (id === "gemini") return createGoogleGenerativeAI({ apiKey: k })(MODELOS.gemini());
  return createAnthropic({ apiKey: k })(MODELOS.claude());
}

/** Los gratuitos disponibles, en orden de preferencia. */
export const gratuitosDisponibles = (): IdProveedor[] =>
  (["groq", "gemini"] as const).filter(id => Boolean(clave(id)));

export const tieneClave = (id: IdProveedor): boolean => Boolean(clave(id));

// --- Enrutado por TAREA (no por coste) ------------------------------------- #
// Cada trabajo prefiere el cerebro que mejor lo hace; gana el primero con clave.
export type Tarea = "estructurar" | "ingerir-grande" | "verificar";

const PREFERENCIA: Record<Tarea, IdProveedor[]> = {
  estructurar: ["groq", "gemini"],       // rápido (LPU)
  "ingerir-grande": ["gemini", "groq"],  // contexto gigante (Gemini ~1M)
  verificar: ["gemini", "groq"],         // grounding (Gemini) o compound (Groq)
};

export function modeloParaTarea(tarea: Tarea): { model: LanguageModel; proveedor: IdProveedor } | null {
  for (const id of PREFERENCIA[tarea]) {
    const m = modeloPara(id);
    if (m) return { model: m, proveedor: id };
  }
  return null;
}

export class SinProveedores extends Error {
  constructor(msg: string) { super(msg); this.name = "SinProveedores"; }
}

/**
 * Ejecuta `llamada` con el proveedor elegido. "auto" rota por los gratuitos
 * y devuelve el primero que responda; "claude" exige su clave y nunca rota.
 */
export async function conRouter<T>(
  eleccion: EleccionProveedor,
  llamada: (model: LanguageModel) => Promise<T>,
): Promise<{ resultado: T; proveedor: IdProveedor }> {
  if (eleccion !== "auto") {
    const model = modeloPara(eleccion);
    if (!model) throw new SinProveedores(`falta la clave de ${eleccion} en .env.local`);
    return { resultado: await llamada(model), proveedor: eleccion };
  }
  const gratuitos = gratuitosDisponibles();
  if (!gratuitos.length) {
    throw new SinProveedores(
      "sin proveedores gratuitos: configura GROQ_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY en .env.local",
    );
  }
  let ultimoError: unknown = null;
  for (const id of gratuitos) {
    try {
      return { resultado: await llamada(modeloPara(id)!), proveedor: id };
    } catch (e) { ultimoError = e; } // rotación silenciosa SOLO entre gratuitos
  }
  throw new Error(`todos los proveedores gratuitos fallaron: ${String(ultimoError)}`);
}
