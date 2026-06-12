import { EditorArbol } from "@/components/editor/editor-arbol";

export default async function PaginaArbol({ params }: { params: Promise<{ materia: string; tema: string }> }) {
  const { materia, tema } = await params;
  return <EditorArbol materia={materia} tema={tema} />;
}
