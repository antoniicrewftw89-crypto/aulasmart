import { SesionRepaso } from "@/components/repaso/sesion-repaso";

export default async function PaginaRepaso({ params }: { params: Promise<{ materia: string; tema: string }> }) {
  const { materia, tema } = await params;
  return <SesionRepaso materia={materia} tema={tema} />;
}
