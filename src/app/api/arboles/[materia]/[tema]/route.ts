// /api/arboles/{materia}/{tema} — GET · PUT · DELETE.
// Next 16: params es Promise → siempre await.
import { NextResponse } from "next/server";
import { validarArbol } from "@/lib/arbol/modelo";
import { slugificar } from "@/lib/arbol/slug";
import type { Arbol } from "@/lib/arbol/types";
import { eliminarArbol, guardarArbol, leerArbol, leerArtefacto, moverArbol } from "@/lib/storage/arboles";
import { borrarArtefactoEspejo, borrarEspejo, espejarArbol, espejarArtefacto } from "@/lib/espejo/obsidian";

type Params = { params: Promise<{ materia: string; tema: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const arbol = leerArbol(materia, tema);
  return arbol
    ? NextResponse.json(arbol)
    : NextResponse.json({ error: "no existe" }, { status: 404 });
}

export async function PUT(req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const body = (await req.json().catch(() => null)) as Arbol | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  if (body.materia !== materia || body.tema !== tema) {
    return NextResponse.json({ error: "materia/tema no coinciden con la URL" }, { status: 400 });
  }
  const errores = validarArbol(body);
  if (errores.length) return NextResponse.json({ error: "árbol inválido", detalles: errores }, { status: 422 });
  guardarArbol(body);
  espejarArbol(body);
  return NextResponse.json({ ok: true, actualizadoEn: body.actualizadoEn });
}

// PATCH { materia } — mueve el lienzo a otra materia (reorganizar la mesa)
export async function PATCH(req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const body = await req.json().catch(() => null);
  const nuevaTxt = typeof body?.materia === "string" ? body.materia.trim() : "";
  if (!nuevaTxt) return NextResponse.json({ error: "materia nueva obligatoria" }, { status: 400 });
  if (!leerArbol(materia, tema)) return NextResponse.json({ error: "no existe" }, { status: 404 });

  const nueva = slugificar(nuevaTxt);
  const movido = moverArbol(materia, tema, nueva);
  if (!movido) {
    return NextResponse.json({ error: `en ${nueva} ya hay un lienzo llamado ${tema}` }, { status: 409 });
  }
  // Espejo: lo viejo fuera, lo nuevo (árbol + guion si existe) a su sitio
  borrarEspejo(materia, tema);
  borrarArtefactoEspejo(materia, `${tema}.guion.md`);
  espejarArbol(movido);
  const guion = leerArtefacto(movido.materia, tema, "guion.md");
  if (guion) espejarArtefacto(movido.materia, `${tema}.guion.md`, guion);
  return NextResponse.json({ ok: true, materia: movido.materia, tema: movido.tema });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const ok = eliminarArbol(materia, tema);
  if (ok) borrarEspejo(materia, tema);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "no existe" }, { status: 404 });
}
