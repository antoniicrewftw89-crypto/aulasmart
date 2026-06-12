// POST /api/arboles/{materia}/{tema}/nodos/{nodoId}/{verificar|investigar}
// La única puerta por la que la IA toca un árbol — y siempre a petición humana.
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { aplicarRespuesta, construirPrompt, EsquemaRespuestaIA, type AccionIA } from "@/lib/ia/acciones-nodo";
import { conRouter, SinProveedores, type EleccionProveedor } from "@/lib/ia/proveedores";
import { guardarArbol, leerArbol } from "@/lib/storage/arboles";
import { espejarArbol } from "@/lib/espejo/obsidian";

type Params = { params: Promise<{ materia: string; tema: string; nodoId: string; accion: string }> };

export async function POST(req: Request, { params }: Params) {
  const { materia, tema, nodoId, accion } = await params;
  if (accion !== "verificar" && accion !== "investigar") {
    return NextResponse.json({ error: "acción desconocida" }, { status: 404 });
  }
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });
  const nodo = arbol.nodos.find(n => n.id === nodoId);
  if (!nodo) return NextResponse.json({ error: "nodo no existe" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const eleccion: EleccionProveedor = body?.proveedor === "claude" || body?.proveedor === "groq" || body?.proveedor === "gemini"
    ? body.proveedor
    : "auto";

  const { system, prompt } = construirPrompt(accion as AccionIA, arbol, nodo);
  try {
    const { resultado, proveedor } = await conRouter(eleccion, model =>
      generateObject({ model, schema: EsquemaRespuestaIA, system, prompt }),
    );
    const actualizado = aplicarRespuesta(arbol, nodoId, resultado.object, new Date().toISOString());
    guardarArbol(actualizado);
    espejarArbol(actualizado);
    return NextResponse.json({
      arbol: actualizado,
      proveedor,
      respuesta: resultado.object,
    });
  } catch (e) {
    if (e instanceof SinProveedores) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: `la IA no pudo responder: ${String(e)}` }, { status: 502 });
  }
}
