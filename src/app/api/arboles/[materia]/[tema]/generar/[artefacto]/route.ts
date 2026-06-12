// POST /api/arboles/{materia}/{tema}/generar/{artefacto}
// F2: "guion". F3/F4 añadirán "quiz" y "slides" aquí mismo.
import { NextResponse } from "next/server";
import { generarGuionMd } from "@/lib/generadores/guion";
import { guardarArtefacto, leerArbol } from "@/lib/storage/arboles";
import { espejarArtefacto } from "@/lib/espejo/obsidian";

type Params = { params: Promise<{ materia: string; tema: string; artefacto: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { materia, tema, artefacto } = await params;
  if (artefacto !== "guion") {
    return NextResponse.json({ error: "artefacto desconocido (disponible: guion)" }, { status: 404 });
  }
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });

  const contenido = generarGuionMd(arbol);
  const ruta = guardarArtefacto(materia, tema, "guion.md", contenido);
  const enBoveda = espejarArtefacto(materia, `${tema}.guion.md`, contenido);
  return NextResponse.json({ ok: true, ruta, enBoveda });
}
