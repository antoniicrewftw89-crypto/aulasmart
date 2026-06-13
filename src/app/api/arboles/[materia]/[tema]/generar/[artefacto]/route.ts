// POST /api/arboles/{materia}/{tema}/generar/{artefacto}
// Artefactos deterministas generados DESDE el árbol: "guion" (F2) y "slides" (F4).
import { NextResponse } from "next/server";
import type { Arbol } from "@/lib/arbol/types";
import { generarGuionMd } from "@/lib/generadores/guion";
import { generarSlidesMd } from "@/lib/generadores/slides";
import { guardarArtefacto, leerArbol } from "@/lib/storage/arboles";
import { espejarArtefacto } from "@/lib/espejo/obsidian";

type Params = { params: Promise<{ materia: string; tema: string; artefacto: string }> };

// artefacto → cómo se genera y con qué sufijo se guarda/espeja.
const GENERADORES: Record<string, { fn: (a: Arbol) => string; sufijo: string }> = {
  guion: { fn: generarGuionMd, sufijo: "guion.md" },
  slides: { fn: generarSlidesMd, sufijo: "slides.md" },
};

export async function POST(_req: Request, { params }: Params) {
  const { materia, tema, artefacto } = await params;
  const gen = GENERADORES[artefacto];
  if (!gen) {
    return NextResponse.json(
      { error: `artefacto desconocido (disponibles: ${Object.keys(GENERADORES).join(", ")})` },
      { status: 404 },
    );
  }
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });

  const contenido = gen.fn(arbol);
  const ruta = guardarArtefacto(materia, tema, gen.sufijo, contenido);
  const enBoveda = espejarArtefacto(materia, `${tema}.${gen.sufijo}`, contenido);
  return NextResponse.json({ ok: true, ruta, enBoveda });
}
