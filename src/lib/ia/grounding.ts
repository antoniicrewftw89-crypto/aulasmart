// grounding.ts — Verificación CON CITAS REALES. Solo servidor.
// Usa la búsqueda web de Gemini para fundamentar el veredicto y devolver las
// fuentes que el modelo REALMENTE consultó (no inventadas). Dos pasos: (1)
// generateText con la herramienta google_search → texto + sources; (2) un
// generateObject que estructura el veredicto. Si no hay clave Gemini, devuelve
// null y el llamador cae al verificar normal (sin grounding).
import { generateText, generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { RespuestaIA } from "./acciones-nodo";

const EsquemaVeredicto = z.object({
  veredicto: z.enum(["correcto", "impreciso", "incorrecto", "ampliado"]),
  explicacion: z.string(),
  estadoSugerido: z.enum(["verificado", "dudoso"]).nullable(),
});

export const hayGrounding = (): boolean => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export async function verificarConGrounding(system: string, prompt: string): Promise<RespuestaIA | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  const modelo = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  // 1) Buscar en la web y razonar → texto + fuentes reales.
  const investigado = await generateText({
    model: google(modelo),
    tools: { google_search: google.tools.googleSearch({}) },
    system,
    prompt: `${prompt}\n\nComprueba el punto con la búsqueda web y cita fuentes reales.`,
  });

  const fuentes: string[] = [];
  for (const s of investigado.sources ?? []) {
    if (s.sourceType === "url" && s.url) fuentes.push(s.url);
  }

  // 2) Estructurar el veredicto a partir del análisis (ya fundamentado).
  const { object } = await generateObject({
    model: google(modelo),
    schema: EsquemaVeredicto,
    system: "Resumes un análisis en un veredicto estructurado, en español, sin relleno.",
    prompt: `Análisis:\n${investigado.text}\n\nDevuelve veredicto, explicacion (breve y concreta) y estadoSugerido (o null si solo se amplió).`,
  });

  return { ...object, fuentes: [...new Set(fuentes)] };
}
