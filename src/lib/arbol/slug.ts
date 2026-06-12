// Convierte un texto libre (materia/tema) en slug seguro para carpeta/URL.
export function slugificar(texto: string): string {
  const slug = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sin tildes (diacríticos sueltos tras NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sin-titulo";
}
