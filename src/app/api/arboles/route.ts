// /api/arboles — GET lista · POST crear.
// Handlers delgados: el trabajo real vive en lib (testeado con vitest).
import { NextResponse } from "next/server";
import { crearArbol } from "@/lib/arbol/modelo";
import { slugificar } from "@/lib/arbol/slug";
import { guardarArbol, leerArbol, listarArboles } from "@/lib/storage/arboles";
import { espejarArbol } from "@/lib/espejo/obsidian";

export async function GET() {
  return NextResponse.json(listarArboles());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const materiaTxt = typeof body?.materia === "string" ? body.materia.trim() : "";
  const temaTxt = typeof body?.tema === "string" ? body.tema.trim() : "";
  if (!materiaTxt || !temaTxt) {
    return NextResponse.json({ error: "materia y tema son obligatorios" }, { status: 400 });
  }
  const materia = slugificar(materiaTxt);
  const tema = slugificar(temaTxt);
  if (leerArbol(materia, tema)) {
    return NextResponse.json({ error: `ya existe ${materia}/${tema}` }, { status: 409 });
  }
  const arbol = crearArbol(materia, tema, temaTxt);
  guardarArbol(arbol);
  espejarArbol(arbol);
  return NextResponse.json(arbol, { status: 201 });
}
