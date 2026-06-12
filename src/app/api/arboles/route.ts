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
  // Crear es LIBRE: sin body (o vacío) nace un lienzo en blanco al instante,
  // como abrir Paint. La materia y el título se definen trabajando.
  // (materia/tema en el body siguen valiendo: es la puerta para Janus.)
  const body = await req.json().catch(() => ({}));
  const materiaTxt = typeof body?.materia === "string" ? body.materia.trim() : "";
  const temaTxt = typeof body?.tema === "string" ? body.tema.trim() : "";

  const materia = materiaTxt ? slugificar(materiaTxt) : "ideas";
  const tema = temaTxt ? slugificar(temaTxt) : `lienzo-${Date.now().toString(36)}`;
  if (leerArbol(materia, tema)) {
    return NextResponse.json({ error: `ya existe ${materia}/${tema}` }, { status: 409 });
  }
  const arbol = crearArbol(materia, tema, temaTxt); // sin tema: título vacío, se escribe en la raíz
  guardarArbol(arbol);
  espejarArbol(arbol);
  return NextResponse.json(arbol, { status: 201 });
}
