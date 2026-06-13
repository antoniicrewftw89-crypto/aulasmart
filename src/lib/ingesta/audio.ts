// audio.ts — Transcribe audio/vídeo con Whisper en Groq (rapidísimo y gratis,
// ~2000 audios/día, 99 idiomas). Solo servidor. Devuelve el texto para que entre
// en la misma tubería de ingesta (estructurar → árbol). Whisper SOLO está en Groq.
import { experimental_transcribe as transcribe } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { SinProveedores } from "../ia/proveedores";

const MODELO = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";

// Extensiones/MIME que tratamos como audio o vídeo (de los que se saca la pista).
export function esAudioOVideo(nombre: string, mime: string): boolean {
  return mime.startsWith("audio/") || mime.startsWith("video/") ||
    /\.(mp3|m4a|wav|ogg|oga|opus|flac|webm|mp4|mpga|mpeg|mov)$/i.test(nombre);
}

export async function transcribir(audio: Uint8Array): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new SinProveedores("transcribir audio necesita GROQ_API_KEY (Whisper) en .env.local");
  const groq = createGroq({ apiKey });
  const { text } = await transcribe({
    model: groq.transcription(MODELO),
    audio,
    providerOptions: { groq: { language: "es" } }, // hint: mejora precisión y latencia
  });
  return (text ?? "").trim();
}
