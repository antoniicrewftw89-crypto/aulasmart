// POST /api/arboles/{materia}/{tema}/completar — "Completar huecos".
// La IA mira el árbol del estudiante y propone los conceptos que faltan; se
// añaden en "borrador" (descartando lo que ya existe) para que el humano apruebe.
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { conRouter, SinProveedores, type EleccionProveedor } from "@/lib/ia/proveedores";
import { EsquemaIngesta } from "@/lib/ingesta/esquema";
import { aplicarHuecos, construirPromptHuecos } from "@/lib/ia/huecos";
import { guardarArbol, leerArbol } from "@/lib/storage/arboles";
import { espejarArbol } from "@/lib/espejo/obsidian";

type Params = { params: Promise<{ materia: string; tema: string }> };

export async function POST(req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const eleccion: EleccionProveedor =
    body?.proveedor === "claude" || body?.proveedor === "groq" || body?.proveedor === "gemini"
      ? body.proveedor : "auto";

  const { system, prompt } = construirPromptHuecos(arbol);
  try {
    const { resultado, proveedor } = await conRouter(eleccion, model =>
      generateObject({ model, schema: EsquemaIngesta, system, prompt }),
    );
    const actualizado = aplicarHuecos(arbol, resultado.object);
    const anadidos = actualizado.nodos.length - arbol.nodos.length;
    if (anadidos > 0) {
      guardarArbol(actualizado);
      espejarArbol(actualizado);
    }
    return NextResponse.json({ arbol: actualizado, proveedor, anadidos });
  } catch (e) {
    if (e instanceof SinProveedores) {
      return NextResponse.json({ error: e.message, sinClave: true }, { status: 503 });
    }
    return NextResponse.json({ error: `la IA no pudo completar: ${String(e)}` }, { status: 502 });
  }
}
