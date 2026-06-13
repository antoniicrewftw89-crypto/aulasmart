// pdf.ts — Extrae el texto de un PDF con unpdf (solo servidor, sin binarios).
// PDFs escaneados (sin capa de texto) devolverán cadena vacía: eso lo maneja la
// API avisando "no se pudo leer" (OCR queda fuera del MVP).
import { extractText, getDocumentProxy } from "unpdf";

export async function extraerTextoPDF(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}
