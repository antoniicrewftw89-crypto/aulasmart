// POST /api/arboles/{materia}/{tema}/conexiones — "Conexiones automáticas".
// La IA busca relaciones conceptuales entre nodos de ramas distintas y las
// dibuja como flechas (cada par lo valida `conectar`). A petición del humano.
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { conRouter, SinProveedores, type EleccionProveedor } from "@/lib/ia/proveedores";
import { EsquemaConexiones, aplicarConexiones, construirPromptConexiones } from "@/lib/ia/conexiones";
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

  const { system, prompt } = construirPromptConexiones(arbol);
  try {
    const { resultado, proveedor } = await conRouter(eleccion, model =>
      generateObject({ model, schema: EsquemaConexiones, system, prompt }),
    );
    const actualizado = aplicarConexiones(arbol, resultado.object.pares);
    const anadidas = actualizado.relaciones.length - arbol.relaciones.length;
    if (anadidas > 0) {
      guardarArbol(actualizado);
      espejarArbol(actualizado);
    }
    return NextResponse.json({ arbol: actualizado, proveedor, anadidas });
  } catch (e) {
    if (e instanceof SinProveedores) {
      return NextResponse.json({ error: e.message, sinClave: true }, { status: 503 });
    }
    return NextResponse.json({ error: `la IA no pudo conectar: ${String(e)}` }, { status: 502 });
  }
}
