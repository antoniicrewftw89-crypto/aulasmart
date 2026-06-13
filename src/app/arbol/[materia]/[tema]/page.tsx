import { EditorArbol } from "@/components/editor/editor-arbol";

export default async function PaginaArbol({
  params, searchParams,
}: {
  params: Promise<{ materia: string; tema: string }>;
  searchParams: Promise<{ revisar?: string }>;
}) {
  const { materia, tema } = await params;
  const { revisar } = await searchParams;
  return <EditorArbol materia={materia} tema={tema} revisarInicial={revisar === "1"} />;
}
