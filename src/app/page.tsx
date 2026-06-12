import { ListaArboles } from "@/components/lista-arboles";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <header className="mb-10">
        <h1 className="manuscrita text-6xl text-[var(--tinta)]">AulaSmart</h1>
        <p className="mt-1 text-sm text-[var(--tinta-suave)]">
          Tu mesa de estudio. Tú piensas en stickies; la IA solo viene si la llamas ✨
        </p>
      </header>
      <ListaArboles />
    </main>
  );
}
