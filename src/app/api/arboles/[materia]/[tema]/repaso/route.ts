// /api/arboles/{materia}/{tema}/repaso
//   GET  → la sesión de tarjetas que toca repasar hoy.
//   POST { nodoId, acierto } → registra el resultado (mueve la caja Leitner).
// Sin IA: el repaso es del estudiante sobre su propio árbol.
import { NextResponse } from "next/server";
import { leerArbol, leerProgreso, guardarProgreso } from "@/lib/storage/arboles";
import { registrarResultado, estadoInicial, type ProgresoNodo } from "@/lib/repaso/leitner";
import { sesionDeHoy, pendientesHoy, type MapaProgreso } from "@/lib/repaso/tarjetas";

type Params = { params: Promise<{ materia: string; tema: string }> };

const hoyIso = () => new Date().toISOString().slice(0, 10);

export async function GET(_req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });
  const progreso = leerProgreso(materia, tema) as MapaProgreso;
  const hoy = hoyIso();
  return NextResponse.json({
    titulo: arbol.titulo,
    tarjetas: sesionDeHoy(arbol, progreso, hoy),
    pendientes: pendientesHoy(arbol, progreso, hoy),
  });
}

export async function POST(req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const arbol = leerArbol(materia, tema);
  if (!arbol) return NextResponse.json({ error: "árbol no existe" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const nodoId = typeof body?.nodoId === "string" ? body.nodoId : "";
  if (!nodoId || !arbol.nodos.some(n => n.id === nodoId)) {
    return NextResponse.json({ error: "nodoId inválido" }, { status: 400 });
  }
  const acierto = Boolean(body?.acierto);
  const hoy = hoyIso();

  const progreso = leerProgreso(materia, tema) as MapaProgreso;
  const previo: ProgresoNodo = progreso[nodoId] ?? estadoInicial(hoy);
  progreso[nodoId] = registrarResultado(previo, acierto, hoy);
  guardarProgreso(materia, tema, progreso);

  return NextResponse.json({ ok: true, progreso: progreso[nodoId], pendientes: pendientesHoy(arbol, progreso, hoy) });
}
