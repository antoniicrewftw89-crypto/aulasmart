// /api/arboles/{materia}/{tema}/tarjetas
//   GET  → el mazo guardado (o null si no hay).
//   POST { motor: "auto"|"determinista", proveedor? } → genera y guarda el mazo.
// La IA hace UNA sola llamada para todo el árbol (no una por nodo).
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { leerArbol, leerMazo, guardarMazo } from "@/lib/storage/arboles";
import {
  aplicarMazoIA, construirPromptMazo, EsquemaMazoIA, generarMazoDeterminista,
} from "@/lib/repaso/generar-tarjetas";
import { conRouter, SinProveedores, type EleccionProveedor } from "@/lib/ia/proveedores";

type Params = { params: Promise<{ materia: string; tema: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { materia, tema } = await params;
  return NextResponse.json({ mazo: leerMazo(materia, tema) });
}

export async function POST(req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const motor: "auto" | "determinista" = body?.motor === "determinista" ? "determinista" : "auto";

  // Sin IA: todo determinista (siempre funciona, sin claves)
  if (motor === "determinista") {
    const mazo = generarMazoDeterminista(arbol);
    guardarMazo(materia, tema, mazo);
    return NextResponse.json({ mazo, motor: "determinista" });
  }

  // Con IA: las "voltear" deterministas + opción múltiple generada por la IA
  const eleccion: EleccionProveedor =
    body?.proveedor === "claude" || body?.proveedor === "groq" || body?.proveedor === "gemini"
      ? body.proveedor : "auto";
  const { system, prompt } = construirPromptMazo(arbol);
  try {
    const { resultado, proveedor } = await conRouter(eleccion, model =>
      generateObject({ model, schema: EsquemaMazoIA, system, prompt }),
    );
    const volteos = generarMazoDeterminista(arbol).filter(t => t.tipo === "voltear");
    const opcionesIA = aplicarMazoIA(arbol, resultado.object);
    const mazo = [...volteos, ...opcionesIA];
    guardarMazo(materia, tema, mazo);
    return NextResponse.json({ mazo, motor: "ia", proveedor });
  } catch (e) {
    if (e instanceof SinProveedores) {
      return NextResponse.json({ error: e.message, sinClave: true }, { status: 503 });
    }
    return NextResponse.json({ error: `la IA no pudo generar: ${String(e)}` }, { status: 502 });
  }
}
