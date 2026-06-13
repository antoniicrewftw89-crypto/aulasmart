// POST /api/ingesta — F5: material (PDF/TXT/pegado) → borrador de árbol.
// La IA propone (gratis-first); el humano aprueba luego en el modo revisión.
// Recibe FormData: texto?, archivo?, destino (JSON), proveedor?.
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { conRouter, SinProveedores, type EleccionProveedor } from "@/lib/ia/proveedores";
import {
  EsquemaIngesta, aplicarOutline, construirArbolIngesta, construirPromptIngesta,
  type RespuestaIngesta,
} from "@/lib/ingesta/esquema";
import { recortar } from "@/lib/ingesta/texto";
import { extraerTextoPDF } from "@/lib/ingesta/pdf";
import { slugificar } from "@/lib/arbol/slug";
import { guardarArbol, leerArbol } from "@/lib/storage/arboles";
import { espejarArbol } from "@/lib/espejo/obsidian";

type Destino =
  | { tipo: "nuevo" }
  | { tipo: "fusionar"; materia: string; tema: string; nodoId: string };

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "esperaba multipart/form-data" }, { status: 400 });

  const pegado = (form.get("texto") ?? "").toString();
  const archivo = form.get("archivo");
  const proveedor = (form.get("proveedor")?.toString() || "auto") as EleccionProveedor;
  let destino: Destino = { tipo: "nuevo" };
  try { destino = JSON.parse(form.get("destino")?.toString() || '{"tipo":"nuevo"}'); } catch { /* nuevo */ }

  // 1) Texto del material
  let material = pegado;
  if (archivo && typeof archivo !== "string") {
    const f = archivo as File;
    const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    try {
      material = esPdf ? await extraerTextoPDF(await f.arrayBuffer()) : await f.text();
    } catch {
      return NextResponse.json({ error: "no se pudo leer el archivo" }, { status: 400 });
    }
  }
  const { texto, recortado } = recortar(material);
  if (!texto.trim()) {
    return NextResponse.json({ error: "el material está vacío o el PDF no tiene texto (¿escaneado?)" }, { status: 400 });
  }

  // 2) IA → outline. Claude solo si lo eliges; sin claves → 503 accionable.
  let resp: RespuestaIngesta;
  try {
    const { system, prompt } = construirPromptIngesta(texto);
    const { resultado } = await conRouter(proveedor, async (model) => {
      const { object } = await generateObject({ model, schema: EsquemaIngesta, system, prompt });
      return object;
    });
    resp = resultado;
  } catch (e) {
    if (e instanceof SinProveedores) {
      return NextResponse.json({ error: e.message, sinClave: true }, { status: 503 });
    }
    return NextResponse.json({ error: "la IA no pudo estructurar el material" }, { status: 502 });
  }

  // 3) Construir y guardar el borrador (todos los nodos nacen en "borrador")
  if (destino.tipo === "fusionar") {
    const arbol = leerArbol(destino.materia, destino.tema);
    if (!arbol) return NextResponse.json({ error: "el tema destino no existe" }, { status: 404 });
    if (!arbol.nodos.some(n => n.id === destino.nodoId)) {
      return NextResponse.json({ error: "nodo destino inválido" }, { status: 400 });
    }
    // El doc entra como una rama "= título" bajo el nodo elegido.
    const fusionado = aplicarOutline(arbol, destino.nodoId, [{ texto: resp.titulo, hijos: resp.ramas }]);
    guardarArbol(fusionado);
    espejarArbol(fusionado);
    return NextResponse.json({ ok: true, materia: fusionado.materia, tema: fusionado.tema, recortado });
  }

  const materia = "ingesta";
  const base = slugificar(resp.titulo);
  const tema = leerArbol(materia, base) ? `${base}-${Date.now().toString(36)}` : base;
  const arbol = construirArbolIngesta(materia, tema, resp);
  guardarArbol(arbol);
  espejarArbol(arbol);
  return NextResponse.json({ ok: true, materia, tema, recortado }, { status: 201 });
}
