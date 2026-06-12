import { ListaArboles } from "@/components/lista-arboles";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">🧠 AulaSmart</h1>
        <p className="text-sm text-neutral-400">
          Tus árboles de ideas. Tú piensas; la IA te ayudará donde se lo pidas.
        </p>
      </header>
      <ListaArboles />
    </main>
  );
}
