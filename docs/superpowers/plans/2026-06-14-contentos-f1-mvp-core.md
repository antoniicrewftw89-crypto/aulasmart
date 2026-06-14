# ContentOS F1 — MVP Core: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar tarea a tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Pegas una URL de video (YouTube/TikTok/IG/X/…) → ContentOS la descarga, transcribe y la analiza con Claude Sonnet (15 análisis + transcripción), mostrando los resultados en streaming y guardando todo en un JSON local. App funcional de punta a punta.

**Architecture:** Repo nuevo e independiente en `C:\Workspace\contentos` (Next.js App Router). El pipeline son funciones puras/aisladas en `src/lib/pipeline/` y `src/lib/analisis/`, encadenadas por un **orquestador** que es un async generator y emite eventos de progreso. Una ruta `POST /api/analizar` consume ese generador y lo reemite como **SSE** a la UI. Sin cola (BullMQ/Redis) ni SQLite en F1 — un video a la vez, persistencia en `data/*.json` con escrituras atómicas (tmp+rename). La generación con Higgsfield/fal.ai/etc. NO entra en F1 (es F3); aquí Claude solo produce el *texto* de los prompts de generación.

**Tech Stack:** Next.js (App Router, TS, Tailwind) · `ai` (Vercel AI SDK v6) · `@ai-sdk/anthropic` · `groq-sdk` (Whisper) · `zod` · `vitest` · binarios de sistema `yt-dlp` + `ffmpeg`.

**Decisiones (con su porqué):**
- **Sin cola en F1.** El spec mete BullMQ+Redis en F4 (bulk). Para un video a la vez, el pipeline corre dentro del route handler y emite progreso por SSE. Es local-first y single-user: sin timeouts de serverless. YAGNI.
- **Sin SQLite en F1.** La búsqueda semántica es F2. En F1 la biblioteca lista los `data/*.json` directamente.
- **Transcripción con `groq-sdk` directo** (no `@ai-sdk/groq`): el endpoint `audio.transcriptions` con `response_format: "verbose_json"` da segmentos con timestamps de forma concreta y documentada. Whisper en Groq es gratis-first.
- **Análisis con `streamObject` (AI SDK v6) + Zod**, modelo `claude-sonnet-4-6`. Un solo objeto estructurado con los 15 campos → permite render incremental. **Sin extended thinking en F1**: combinar thinking + salida estructurada añade fricción del SDK; la calidad de Sonnet con `streamObject` ya es alta. Queda como mejora anotada para después.
- **Frames opcionales.** Si FFmpeg extrae frames, se pasan a Claude como imágenes (visión); si no, el análisis degrada a solo-transcripción sin romperse. El usuario pidió "video, audio y todo" → los incluimos, pero sin que sean un punto único de fallo.
- **Claves por env** (`.env.local`): `ANTHROPIC_API_KEY` (obligatoria para analizar), `GROQ_API_KEY` (obligatoria para transcribir). Sin ellas, la UI muestra un mensaje accionable, no un crash.

---

### Task 0: Scaffold del repo + tooling

**Files:**
- Create: todo `C:\Workspace\contentos\` (vía create-next-app)
- Create: `C:\Workspace\contentos\vitest.config.ts`, `.env.example`, `.gitignore` (ajuste)

- [ ] **Step 1: Crear el proyecto**

Desde `C:\Workspace`:
```bash
pnpm create next-app@latest contentos --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack
```
(Si el prompt pregunta por más opciones, aceptar defaults.)

- [ ] **Step 2: Instalar dependencias**

```bash
cd contentos
pnpm add ai @ai-sdk/anthropic groq-sdk zod
pnpm add -D vitest @vitest/coverage-v8 tsx
```

- [ ] **Step 3: Configurar vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Añadir a `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: `.env.example` y carpeta de datos**

Create `.env.example`:
```
# Obligatorias para el MVP
ANTHROPIC_API_KEY=
GROQ_API_KEY=

# Opcionales (overrides)
ANTHROPIC_MODEL=claude-sonnet-4-6
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
CONTENTOS_DATA_DIR=./data
```

Añadir a `.gitignore`:
```
/data
.env.local
.tmp-pipeline
```

Create `data/.gitkeep` (vacío) para que la carpeta exista.

- [ ] **Step 5: Verificar que arranca y commit**

```bash
pnpm typecheck
pnpm dev   # comprobar http://localhost:3000, luego Ctrl+C
git init && git add -A && git commit -m "chore: scaffold ContentOS (Next.js + AI SDK + vitest)"
```
Expected: typecheck sin errores; la home de Next carga.

---

### Task 1: Verificar entorno (yt-dlp + ffmpeg)

**Files:**
- Create: `src/lib/pipeline/entorno.ts`
- Test: `src/lib/pipeline/entorno.test.ts`

`yt-dlp` y `ffmpeg` son binarios de sistema. En Windows: `winget install yt-dlp.yt-dlp` y `winget install Gyan.FFmpeg` (o `scoop install yt-dlp ffmpeg`). Esta tarea detecta su ausencia y parsea su versión.

- [ ] **Step 1: Test del parser de versión (puro)**

Create `src/lib/pipeline/entorno.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parsearVersion } from "./entorno";

describe("parsearVersion", () => {
  it("extrae la versión de yt-dlp", () => {
    expect(parsearVersion("2025.06.01")).toBe("2025.06.01");
  });
  it("extrae la versión de ffmpeg de su banner", () => {
    const banner = "ffmpeg version 7.1 Copyright (c) 2000-2024";
    expect(parsearVersion(banner)).toBe("7.1");
  });
  it("devuelve null si no hay versión reconocible", () => {
    expect(parsearVersion("comando no encontrado")).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `pnpm vitest run src/lib/pipeline/entorno.test.ts`
Expected: FAIL — `parsearVersion is not a function`.

- [ ] **Step 3: Implementar**

Create `src/lib/pipeline/entorno.ts`:
```ts
import { spawn } from "node:child_process";

/** Extrae el primer token tipo versión (1.2 / 2025.06.01) de una salida CLI. */
export function parsearVersion(salida: string): string | null {
  const m = salida.match(/\b\d+(?:\.\d+){1,3}\b/);
  return m ? m[0] : null;
}

function ejecutar(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d)); // ffmpeg imprime versión por stderr
    p.on("error", reject);
    p.on("close", () => resolve(out));
  });
}

export interface EstadoEntorno {
  ytDlp: string | null;
  ffmpeg: string | null;
  ok: boolean;
}

/** Comprueba que yt-dlp y ffmpeg están en el PATH y devuelve sus versiones. */
export async function verificarEntorno(): Promise<EstadoEntorno> {
  const [yt, ff] = await Promise.all([
    ejecutar("yt-dlp", ["--version"]).catch(() => ""),
    ejecutar("ffmpeg", ["-version"]).catch(() => ""),
  ]);
  const ytDlp = parsearVersion(yt);
  const ffmpeg = parsearVersion(ff);
  return { ytDlp, ffmpeg, ok: Boolean(ytDlp && ffmpeg) };
}
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/pipeline/entorno.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/entorno.ts src/lib/pipeline/entorno.test.ts
git commit -m "feat: verificación de entorno (yt-dlp + ffmpeg)"
```

---

### Task 2: Detección de plataforma (puro)

**Files:**
- Create: `src/lib/pipeline/detectar.ts`
- Test: `src/lib/pipeline/detectar.test.ts`

- [ ] **Step 1: Test**

Create `src/lib/pipeline/detectar.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectarPlataforma } from "./detectar";

describe("detectarPlataforma", () => {
  it("reconoce YouTube (largo y corto)", () => {
    expect(detectarPlataforma("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectarPlataforma("https://youtu.be/abc")).toBe("youtube");
  });
  it("reconoce TikTok, Instagram, X, Twitch, Reddit, Vimeo", () => {
    expect(detectarPlataforma("https://www.tiktok.com/@a/video/1")).toBe("tiktok");
    expect(detectarPlataforma("https://www.instagram.com/reel/x/")).toBe("instagram");
    expect(detectarPlataforma("https://x.com/a/status/1")).toBe("twitter");
    expect(detectarPlataforma("https://twitter.com/a/status/1")).toBe("twitter");
    expect(detectarPlataforma("https://clips.twitch.tv/abc")).toBe("twitch");
    expect(detectarPlataforma("https://www.reddit.com/r/a/comments/1")).toBe("reddit");
    expect(detectarPlataforma("https://vimeo.com/123")).toBe("vimeo");
  });
  it("devuelve 'desconocida' para lo no soportado", () => {
    expect(detectarPlataforma("https://ejemplo.com/v")).toBe("desconocida");
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/pipeline/detectar.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Create `src/lib/pipeline/detectar.ts`:
```ts
export type Plataforma =
  | "youtube" | "tiktok" | "instagram" | "twitter"
  | "twitch" | "reddit" | "vimeo" | "facebook" | "desconocida";

const REGLAS: [RegExp, Plataforma][] = [
  [/(?:youtube\.com|youtu\.be)/i, "youtube"],
  [/tiktok\.com/i, "tiktok"],
  [/instagram\.com/i, "instagram"],
  [/(?:x\.com|twitter\.com)/i, "twitter"],
  [/twitch\.tv/i, "twitch"],
  [/reddit\.com/i, "reddit"],
  [/vimeo\.com/i, "vimeo"],
  [/facebook\.com|fb\.watch/i, "facebook"],
];

/** Identifica la plataforma a partir de la URL. */
export function detectarPlataforma(url: string): Plataforma {
  for (const [re, plat] of REGLAS) if (re.test(url)) return plat;
  return "desconocida";
}
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/pipeline/detectar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/detectar.ts src/lib/pipeline/detectar.test.ts
git commit -m "feat: detección de plataforma por URL"
```

---

### Task 3: Tipos + esquema Zod del análisis (puro)

**Files:**
- Create: `src/lib/analisis/esquema.ts`
- Test: `src/lib/analisis/esquema.test.ts`

Aquí se define el contrato de los 15 análisis que produce Claude (la transcripción es el 16º y viene de Whisper).

- [ ] **Step 1: Test**

Create `src/lib/analisis/esquema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { EsquemaAnalisisIA } from "./esquema";

const ejemploValido = {
  resumen: "Trata sobre X.",
  hooks: [{ timestamp: "00:03", texto: "¿Sabías que...?", porqueFunciona: "curiosidad" }],
  ideasContenido: [{ formato: "reel", titulo: "Idea 1", descripcion: "..." }],
  estrategia: "Estructura problema-solución.",
  contextoGeneracion: "Tono enérgico, plano cenital.",
  estructura: [{ etiqueta: "intro", inicio: "00:00", fin: "00:05", resumen: "saluda" }],
  guion: "Hola, hoy...",
  estiloVisual: "Cortes rápidos, texto amarillo.",
  musica: "Beat lo-fi de fondo.",
  arcoEmocional: [{ timestamp: "00:10", emocion: "sorpresa", intensidad: 8 }],
  seo: { keywords: ["x", "y"], hashtags: ["#x"] },
  audiencia: "18-25, interesados en productividad.",
  repurposing: [{ formato: "thread", titulo: "T", descripcion: "..." }],
  promptsImagen: [{ escena: "thumbnail", prompt: "...", herramientaSugerida: "Flux" }],
  promptsVideo: [{ escena: "apertura", prompt: "...", herramientaSugerida: "Higgsfield" }],
};

describe("EsquemaAnalisisIA", () => {
  it("acepta un análisis válido", () => {
    expect(() => EsquemaAnalisisIA.parse(ejemploValido)).not.toThrow();
  });
  it("rechaza intensidad fuera de rango", () => {
    const malo = { ...ejemploValido, arcoEmocional: [{ timestamp: "0", emocion: "x", intensidad: 99 }] };
    expect(() => EsquemaAnalisisIA.parse(malo)).toThrow();
  });
  it("rechaza si falta el resumen", () => {
    const { resumen, ...sinResumen } = ejemploValido;
    expect(() => EsquemaAnalisisIA.parse(sinResumen)).toThrow();
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/analisis/esquema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `src/lib/analisis/esquema.ts`:
```ts
import { z } from "zod";

const Hook = z.object({
  timestamp: z.string(),
  texto: z.string(),
  porqueFunciona: z.string(),
});

const Idea = z.object({
  formato: z.string(),       // "reel" | "thread" | "carrusel" | "short" | ...
  titulo: z.string(),
  descripcion: z.string(),
});

const Segmento = z.object({
  etiqueta: z.string(),      // "intro" | "desarrollo" | "giro" | "cta" | "outro"
  inicio: z.string(),
  fin: z.string(),
  resumen: z.string(),
});

const PuntoEmocional = z.object({
  timestamp: z.string(),
  emocion: z.string(),
  intensidad: z.number().min(0).max(10),
});

const PromptGeneracion = z.object({
  escena: z.string(),
  prompt: z.string(),
  herramientaSugerida: z.string(),
});

/** Los 15 análisis que produce Claude (B–P del spec; A = transcripción de Whisper). */
export const EsquemaAnalisisIA = z.object({
  resumen: z.string(),                       // B
  hooks: z.array(Hook),                      // C
  ideasContenido: z.array(Idea),             // D
  estrategia: z.string(),                    // E
  contextoGeneracion: z.string(),            // F
  estructura: z.array(Segmento),             // G
  guion: z.string(),                         // H
  estiloVisual: z.string(),                  // I
  musica: z.string(),                        // J
  arcoEmocional: z.array(PuntoEmocional),    // K
  seo: z.object({ keywords: z.array(z.string()), hashtags: z.array(z.string()) }), // L
  audiencia: z.string(),                     // M
  repurposing: z.array(Idea),                // N
  promptsImagen: z.array(PromptGeneracion),  // O
  promptsVideo: z.array(PromptGeneracion),   // P
});

export type AnalisisIA = z.infer<typeof EsquemaAnalisisIA>;
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/analisis/esquema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analisis/esquema.ts src/lib/analisis/esquema.test.ts
git commit -m "feat: esquema Zod de los 15 análisis"
```

---

### Task 4: Tipos del dominio + storage JSON atómico (puro)

**Files:**
- Create: `src/lib/storage/tipos.ts`
- Create: `src/lib/storage/disco.ts`
- Test: `src/lib/storage/disco.test.ts`

- [ ] **Step 1: Tipos del dominio**

Create `src/lib/storage/tipos.ts`:
```ts
import type { Plataforma } from "@/lib/pipeline/detectar";
import type { AnalisisIA } from "@/lib/analisis/esquema";

export interface MetadataVideo {
  titulo: string;
  autor: string;
  duracion: number;         // segundos
  vistas?: number;
  likes?: number;
  descripcion?: string;
}

export interface SegmentoTranscript {
  inicio: number;           // segundos
  fin: number;
  texto: string;
}

export interface Transcript {
  texto: string;
  idioma: string;
  segmentos: SegmentoTranscript[];
}

export interface Analisis {
  id: string;               // hash de la URL
  url: string;
  plataforma: Plataforma;
  metadata: MetadataVideo;
  transcript: Transcript;
  analisis: AnalisisIA;
  fechaAnalisis: string;    // ISO
  version: 1;
}
```

- [ ] **Step 2: Test del slug y del round-trip**

Create `src/lib/storage/disco.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slugDeUrl, guardarAnalisis, leerAnalisis, listarAnalisis } from "./disco";
import type { Analisis } from "./tipos";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "contentos-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const base: Analisis = {
  id: "x", url: "https://youtu.be/abc", plataforma: "youtube",
  metadata: { titulo: "T", autor: "A", duracion: 10 },
  transcript: { texto: "hola", idioma: "es", segmentos: [] },
  analisis: {
    resumen: "r", hooks: [], ideasContenido: [], estrategia: "e",
    contextoGeneracion: "c", estructura: [], guion: "g", estiloVisual: "v",
    musica: "m", arcoEmocional: [], seo: { keywords: [], hashtags: [] },
    audiencia: "a", repurposing: [], promptsImagen: [], promptsVideo: [],
  },
  fechaAnalisis: "2026-06-14T00:00:00.000Z", version: 1,
};

describe("slugDeUrl", () => {
  it("es determinista y estable para la misma URL", () => {
    expect(slugDeUrl("https://youtu.be/abc")).toBe(slugDeUrl("https://youtu.be/abc"));
  });
  it("difiere entre URLs distintas", () => {
    expect(slugDeUrl("https://youtu.be/a")).not.toBe(slugDeUrl("https://youtu.be/b"));
  });
});

describe("storage round-trip", () => {
  it("guarda y relee el mismo análisis", async () => {
    const a = { ...base, id: slugDeUrl(base.url) };
    await guardarAnalisis(a, dir);
    const leido = await leerAnalisis(a.id, dir);
    expect(leido).toEqual(a);
  });
  it("lista los análisis guardados (resumen)", async () => {
    const a = { ...base, id: slugDeUrl(base.url) };
    await guardarAnalisis(a, dir);
    const lista = await listarAnalisis(dir);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: a.id, titulo: "T", plataforma: "youtube" });
  });
  it("listarAnalisis devuelve [] si la carpeta no tiene análisis", async () => {
    expect(await listarAnalisis(dir)).toEqual([]);
  });
});
```

- [ ] **Step 3: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/storage/disco.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar**

Create `src/lib/storage/disco.ts`:
```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Analisis } from "./tipos";

const DIR_POR_DEFECTO = process.env.CONTENTOS_DATA_DIR || "./data";

/** Id estable y corto a partir de la URL. */
export function slugDeUrl(url: string): string {
  return createHash("sha1").update(url.trim()).digest("hex").slice(0, 12);
}

/** Escritura atómica: archivo temporal + rename. */
export async function guardarAnalisis(a: Analisis, dir = DIR_POR_DEFECTO): Promise<void> {
  await mkdir(dir, { recursive: true });
  const destino = join(dir, `${a.id}.json`);
  const tmp = `${destino}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(a, null, 2), "utf8");
  await rename(tmp, destino);
}

export async function leerAnalisis(id: string, dir = DIR_POR_DEFECTO): Promise<Analisis | null> {
  try {
    const txt = await readFile(join(dir, `${id}.json`), "utf8");
    return JSON.parse(txt) as Analisis;
  } catch {
    return null;
  }
}

export interface ResumenAnalisis {
  id: string;
  titulo: string;
  plataforma: string;
  url: string;
  fechaAnalisis: string;
}

/** Lista ligera para la biblioteca (no carga el análisis completo en memoria del cliente). */
export async function listarAnalisis(dir = DIR_POR_DEFECTO): Promise<ResumenAnalisis[]> {
  let archivos: string[];
  try {
    archivos = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const resúmenes: ResumenAnalisis[] = [];
  for (const f of archivos) {
    try {
      const a = JSON.parse(await readFile(join(dir, f), "utf8")) as Analisis;
      resúmenes.push({
        id: a.id, titulo: a.metadata.titulo, plataforma: a.plataforma,
        url: a.url, fechaAnalisis: a.fechaAnalisis,
      });
    } catch { /* ignora archivos corruptos */ }
  }
  return resúmenes.sort((x, y) => y.fechaAnalisis.localeCompare(x.fechaAnalisis));
}
```

- [ ] **Step 5: Tests en verde + commit**

Run: `pnpm vitest run src/lib/storage/disco.test.ts`
Expected: PASS.
```bash
git add src/lib/storage/
git commit -m "feat: tipos del dominio + storage JSON atómico"
```

---

### Task 5: Descarga con yt-dlp

**Files:**
- Create: `src/lib/pipeline/descargar.ts`
- Test: `src/lib/pipeline/descargar.test.ts`

Se testea la **construcción del comando** y el **parseo de metadata** (puros). La descarga real la prueba Antonio al final (Task 14).

- [ ] **Step 1: Test (puro)**

Create `src/lib/pipeline/descargar.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { argsYtDlp, parsearMetadata } from "./descargar";

describe("argsYtDlp", () => {
  it("pide mp4, salida a la carpeta dada y volcado de metadata JSON", () => {
    const args = argsYtDlp("https://youtu.be/abc", "/tmp/job1");
    expect(args).toContain("https://youtu.be/abc");
    expect(args.join(" ")).toContain("/tmp/job1");
    expect(args).toContain("--print-json");
  });
});

describe("parsearMetadata", () => {
  it("mapea los campos de yt-dlp a MetadataVideo", () => {
    const json = JSON.stringify({
      title: "Mi video", uploader: "Canal", duration: 123,
      view_count: 1000, like_count: 50, description: "desc",
    });
    const m = parsearMetadata(json);
    expect(m).toEqual({
      titulo: "Mi video", autor: "Canal", duracion: 123,
      vistas: 1000, likes: 50, descripcion: "desc",
    });
  });
  it("tolera campos ausentes", () => {
    const m = parsearMetadata(JSON.stringify({ title: "Solo título" }));
    expect(m.titulo).toBe("Solo título");
    expect(m.autor).toBe("desconocido");
    expect(m.duracion).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/pipeline/descargar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `src/lib/pipeline/descargar.ts`:
```ts
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MetadataVideo } from "@/lib/storage/tipos";

/** Args de yt-dlp: descarga mp4 a `dir/video.<ext>` y vuelca metadata JSON por stdout. */
export function argsYtDlp(url: string, dir: string): string[] {
  return [
    "-f", "mp4/best",
    "-o", join(dir, "video.%(ext)s"),
    "--no-playlist",
    "--print-json",
    url,
  ];
}

export function parsearMetadata(jsonLinea: string): MetadataVideo {
  const o = JSON.parse(jsonLinea) as Record<string, unknown>;
  return {
    titulo: (o.title as string) ?? "desconocido",
    autor: (o.uploader as string) ?? "desconocido",
    duracion: (o.duration as number) ?? 0,
    vistas: o.view_count as number | undefined,
    likes: o.like_count as number | undefined,
    descripcion: o.description as string | undefined,
  };
}

export interface VideoDescargado {
  rutaVideo: string;
  metadata: MetadataVideo;
}

/** Descarga el video y devuelve su ruta + metadata. */
export async function descargarVideo(url: string, dir: string): Promise<VideoDescargado> {
  await mkdir(dir, { recursive: true });
  const args = argsYtDlp(url, dir);
  const json = await new Promise<string>((resolve, reject) => {
    const p = spawn("yt-dlp", args);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim().split("\n").pop() ?? "")
                 : reject(new Error(`yt-dlp falló (${code}): ${err.slice(0, 500)}`)),
    );
  });
  return { rutaVideo: join(dir, "video.mp4"), metadata: parsearMetadata(json) };
}
```

- [ ] **Step 4: Tests en verde + commit**

Run: `pnpm vitest run src/lib/pipeline/descargar.test.ts`
Expected: PASS.
```bash
git add src/lib/pipeline/descargar.ts src/lib/pipeline/descargar.test.ts
git commit -m "feat: descarga de video con yt-dlp"
```

---

### Task 6: Extracción de audio y frames con FFmpeg

**Files:**
- Create: `src/lib/pipeline/media.ts`
- Test: `src/lib/pipeline/media.test.ts`

- [ ] **Step 1: Test (construcción de comandos)**

Create `src/lib/pipeline/media.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { argsAudio, argsFrames, timestampsFrames } from "./media";

describe("argsAudio", () => {
  it("extrae mp3 mono 16kHz (ideal para Whisper)", () => {
    const a = argsAudio("/tmp/j/video.mp4", "/tmp/j/audio.mp3");
    expect(a).toContain("/tmp/j/video.mp4");
    expect(a).toContain("/tmp/j/audio.mp3");
    expect(a.join(" ")).toContain("-ac 1");
    expect(a.join(" ")).toContain("-ar 16000");
  });
});

describe("timestampsFrames", () => {
  it("reparte n frames uniformemente evitando los extremos", () => {
    expect(timestampsFrames(100, 4)).toEqual([10, 30, 50, 70]);
  });
  it("con duración 0 devuelve [0]", () => {
    expect(timestampsFrames(0, 4)).toEqual([0]);
  });
});

describe("argsFrames", () => {
  it("captura un frame en el segundo indicado", () => {
    const a = argsFrames("/tmp/j/video.mp4", 30, "/tmp/j/frame-30.jpg");
    expect(a.join(" ")).toContain("-ss 30");
    expect(a).toContain("/tmp/j/frame-30.jpg");
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/pipeline/media.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `src/lib/pipeline/media.ts`:
```ts
import { spawn } from "node:child_process";
import { join } from "node:path";

export function argsAudio(video: string, salida: string): string[] {
  return ["-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", salida];
}

/** Reparte n instantes uniformemente, dejando margen en los extremos. */
export function timestampsFrames(duracion: number, n: number): number[] {
  if (duracion <= 0) return [0];
  const paso = duracion / (n + 1);
  return Array.from({ length: n }, (_, i) => Math.round(paso * (i + 1)));
}

export function argsFrames(video: string, segundo: number, salida: string): string[] {
  return ["-y", "-ss", String(segundo), "-i", video, "-frames:v", "1", "-q:v", "3", salida];
}

function correr(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg (${c}): ${err.slice(0, 300)}`))));
  });
}

export async function extraerAudio(video: string, dir: string): Promise<string> {
  const salida = join(dir, "audio.mp3");
  await correr(argsAudio(video, salida));
  return salida;
}

/** Extrae n frames JPG y devuelve sus rutas. */
export async function extraerFrames(video: string, dir: string, duracion: number, n = 4): Promise<string[]> {
  const segundos = timestampsFrames(duracion, n);
  const rutas: string[] = [];
  for (const s of segundos) {
    const salida = join(dir, `frame-${s}.jpg`);
    await correr(argsFrames(video, s, salida));
    rutas.push(salida);
  }
  return rutas;
}
```

- [ ] **Step 4: Tests en verde + commit**

Run: `pnpm vitest run src/lib/pipeline/media.test.ts`
Expected: PASS.
```bash
git add src/lib/pipeline/media.ts src/lib/pipeline/media.test.ts
git commit -m "feat: extracción de audio y frames con ffmpeg"
```

---

### Task 7: Transcripción con Groq Whisper

**Files:**
- Create: `src/lib/pipeline/transcribir.ts`
- Test: `src/lib/pipeline/transcribir.test.ts`

Se testea la **normalización** de la respuesta de Whisper (puro). La llamada real la prueba Antonio (Task 14).

- [ ] **Step 1: Test**

Create `src/lib/pipeline/transcribir.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizarWhisper } from "./transcribir";

describe("normalizarWhisper", () => {
  it("mapea verbose_json a nuestro Transcript", () => {
    const resp = {
      text: "Hola mundo",
      language: "spanish",
      segments: [
        { start: 0, end: 1.5, text: "Hola" },
        { start: 1.5, end: 3, text: " mundo" },
      ],
    };
    const t = normalizarWhisper(resp);
    expect(t.texto).toBe("Hola mundo");
    expect(t.idioma).toBe("spanish");
    expect(t.segmentos).toEqual([
      { inicio: 0, fin: 1.5, texto: "Hola" },
      { inicio: 1.5, fin: 3, texto: "mundo" },
    ]);
  });
  it("tolera respuesta sin segmentos", () => {
    const t = normalizarWhisper({ text: "x", language: "es" });
    expect(t.segmentos).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/pipeline/transcribir.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `src/lib/pipeline/transcribir.ts`:
```ts
import { createReadStream } from "node:fs";
import Groq from "groq-sdk";
import type { Transcript } from "@/lib/storage/tipos";

interface RespWhisper {
  text: string;
  language?: string;
  segments?: { start: number; end: number; text: string }[];
}

/** Convierte la respuesta verbose_json de Whisper a nuestro Transcript. */
export function normalizarWhisper(r: RespWhisper): Transcript {
  return {
    texto: r.text.trim(),
    idioma: r.language ?? "desconocido",
    segmentos: (r.segments ?? []).map((s) => ({
      inicio: s.start, fin: s.end, texto: s.text.trim(),
    })),
  };
}

const MODELO = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";

/** Transcribe un MP3 con Groq Whisper (gratis-first). */
export async function transcribir(audioPath: string): Promise<Transcript> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const resp = await groq.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: MODELO,
    response_format: "verbose_json",
  });
  return normalizarWhisper(resp as unknown as RespWhisper);
}
```

- [ ] **Step 4: Tests en verde + commit**

Run: `pnpm vitest run src/lib/pipeline/transcribir.test.ts`
Expected: PASS.
```bash
git add src/lib/pipeline/transcribir.ts src/lib/pipeline/transcribir.test.ts
git commit -m "feat: transcripción con Groq Whisper"
```

---

### Task 8: Prompt + análisis con Claude (streamObject)

**Files:**
- Create: `src/lib/analisis/prompt.ts`
- Create: `src/lib/analisis/analizar.ts`
- Test: `src/lib/analisis/prompt.test.ts`

Se testea la **construcción del prompt** (puro). La llamada a Claude la prueba Antonio (Task 14).

- [ ] **Step 1: Test del prompt**

Create `src/lib/analisis/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { construirPrompt } from "./prompt";
import type { MetadataVideo, Transcript } from "@/lib/storage/tipos";

const meta: MetadataVideo = { titulo: "Cómo ahorrar", autor: "Finanzas", duracion: 60 };
const tr: Transcript = { texto: "Hoy te enseño a ahorrar.", idioma: "es", segmentos: [] };

describe("construirPrompt", () => {
  it("incluye título, autor y la transcripción", () => {
    const p = construirPrompt(meta, tr, "youtube");
    expect(p).toContain("Cómo ahorrar");
    expect(p).toContain("Finanzas");
    expect(p).toContain("Hoy te enseño a ahorrar");
    expect(p).toContain("youtube");
  });
  it("pide responder en español", () => {
    expect(construirPrompt(meta, tr, "youtube").toLowerCase()).toContain("español");
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/analisis/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar prompt**

Create `src/lib/analisis/prompt.ts`:
```ts
import type { MetadataVideo, Transcript } from "@/lib/storage/tipos";
import type { Plataforma } from "@/lib/pipeline/detectar";

/** Prompt para el análisis completo. Se acompaña de los frames como imágenes aparte. */
export function construirPrompt(meta: MetadataVideo, tr: Transcript, plat: Plataforma): string {
  return [
    `Eres un analista experto de contenido viral para redes sociales.`,
    `Analiza este video de ${plat} y devuelve los 15 análisis del esquema.`,
    `Responde SIEMPRE en español, con texto accionable y concreto.`,
    ``,
    `# Metadatos`,
    `Título: ${meta.titulo}`,
    `Autor: ${meta.autor}`,
    `Duración: ${meta.duracion}s`,
    meta.descripcion ? `Descripción: ${meta.descripcion}` : ``,
    ``,
    `# Transcripción`,
    tr.texto,
    ``,
    `Las imágenes adjuntas son fotogramas clave del video; úsalas para los`,
    `análisis visuales (estiloVisual, promptsImagen, promptsVideo).`,
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 4: Implementar el análisis (streamObject)**

Create `src/lib/analisis/analizar.ts`:
```ts
import { readFile } from "node:fs/promises";
import { streamObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { EsquemaAnalisisIA, type AnalisisIA } from "./esquema";
import { construirPrompt } from "./prompt";
import type { MetadataVideo, Transcript } from "@/lib/storage/tipos";
import type { Plataforma } from "@/lib/pipeline/detectar";

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export interface EntradaAnalisis {
  meta: MetadataVideo;
  transcript: Transcript;
  plataforma: Plataforma;
  frames: string[];        // rutas a JPG (puede ir vacío)
}

/**
 * Analiza el contenido con Claude Sonnet vía streamObject.
 * `onParcial` recibe el objeto parcial conforme se va construyendo (para streaming UI).
 */
export async function analizarContenido(
  e: EntradaAnalisis,
  onParcial?: (p: Partial<AnalisisIA>) => void,
): Promise<AnalisisIA> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const texto = construirPrompt(e.meta, e.transcript, e.plataforma);

  const imagenes = await Promise.all(
    e.frames.map(async (f) => ({ type: "image" as const, image: await readFile(f) })),
  );

  const { partialObjectStream, object } = streamObject({
    model: anthropic(MODELO),
    schema: EsquemaAnalisisIA,
    messages: [
      { role: "user", content: [{ type: "text", text: texto }, ...imagenes] },
    ],
  });

  for await (const parcial of partialObjectStream) {
    onParcial?.(parcial as Partial<AnalisisIA>);
  }
  return object;
}
```

- [ ] **Step 5: Tests en verde + commit**

Run: `pnpm vitest run src/lib/analisis/prompt.test.ts && pnpm typecheck`
Expected: PASS y typecheck limpio.
```bash
git add src/lib/analisis/prompt.ts src/lib/analisis/analizar.ts src/lib/analisis/prompt.test.ts
git commit -m "feat: prompt + análisis con Claude (streamObject + visión)"
```

---

### Task 9: Orquestador del pipeline (async generator)

**Files:**
- Create: `src/lib/pipeline/orquestador.ts`
- Test: `src/lib/pipeline/orquestador.test.ts`

El orquestador encadena las etapas y **emite eventos**. Para testearlo sin red ni binarios, recibe sus dependencias por inyección (un objeto `etapas`).

- [ ] **Step 1: Test con etapas mockeadas**

Create `src/lib/pipeline/orquestador.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ejecutarPipeline, type Etapas } from "./orquestador";
import type { AnalisisIA } from "@/lib/analisis/esquema";

const analisisFake: AnalisisIA = {
  resumen: "r", hooks: [], ideasContenido: [], estrategia: "e", contextoGeneracion: "c",
  estructura: [], guion: "g", estiloVisual: "v", musica: "m", arcoEmocional: [],
  seo: { keywords: [], hashtags: [] }, audiencia: "a", repurposing: [],
  promptsImagen: [], promptsVideo: [],
};

const etapasFake: Etapas = {
  descargar: async () => ({ rutaVideo: "/tmp/v.mp4", metadata: { titulo: "T", autor: "A", duracion: 10 } }),
  extraerAudio: async () => "/tmp/a.mp3",
  extraerFrames: async () => ["/tmp/f1.jpg"],
  transcribir: async () => ({ texto: "hola", idioma: "es", segmentos: [] }),
  analizar: async (_e, onParcial) => { onParcial?.({ resumen: "r" }); return analisisFake; },
  guardar: async () => {},
};

describe("ejecutarPipeline", () => {
  it("emite las fases en orden y termina en 'completado'", async () => {
    const tipos: string[] = [];
    let completado = false;
    for await (const ev of ejecutarPipeline("https://youtu.be/abc", etapasFake, "/tmp/job")) {
      tipos.push(ev.tipo === "progreso" ? `progreso:${ev.fase}` : ev.tipo);
      if (ev.tipo === "completado") {
        completado = true;
        expect(ev.analisis.plataforma).toBe("youtube");
        expect(ev.analisis.id).toHaveLength(12);
      }
    }
    expect(completado).toBe(true);
    expect(tipos).toEqual([
      "progreso:descargar", "progreso:extraer", "progreso:transcribir",
      "progreso:analizar", "parcial", "progreso:guardar", "completado",
    ]);
  });

  it("emite 'error' si una etapa falla", async () => {
    const rotas = { ...etapasFake, transcribir: async () => { throw new Error("boom"); } };
    const tipos: string[] = [];
    for await (const ev of ejecutarPipeline("https://youtu.be/abc", rotas, "/tmp/job")) {
      tipos.push(ev.tipo);
    }
    expect(tipos).toContain("error");
    expect(tipos).not.toContain("completado");
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/pipeline/orquestador.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `src/lib/pipeline/orquestador.ts`:
```ts
import { detectarPlataforma } from "./detectar";
import { descargarVideo, type VideoDescargado } from "./descargar";
import { extraerAudio, extraerFrames } from "./media";
import { transcribir } from "./transcribir";
import { analizarContenido, type EntradaAnalisis } from "@/lib/analisis/analizar";
import { guardarAnalisis, slugDeUrl } from "@/lib/storage/disco";
import type { AnalisisIA } from "@/lib/analisis/esquema";
import type { Analisis, Transcript } from "@/lib/storage/tipos";

export type FasePipeline = "descargar" | "extraer" | "transcribir" | "analizar" | "guardar";

export type EventoPipeline =
  | { tipo: "progreso"; fase: FasePipeline; mensaje: string }
  | { tipo: "parcial"; parcial: Partial<AnalisisIA> }
  | { tipo: "completado"; analisis: Analisis }
  | { tipo: "error"; mensaje: string };

/** Dependencias inyectables (para test). En producción se usan las reales por defecto. */
export interface Etapas {
  descargar: (url: string, dir: string) => Promise<VideoDescargado>;
  extraerAudio: (video: string, dir: string) => Promise<string>;
  extraerFrames: (video: string, dir: string, dur: number) => Promise<string[]>;
  transcribir: (audio: string) => Promise<Transcript>;
  analizar: (e: EntradaAnalisis, onParcial?: (p: Partial<AnalisisIA>) => void) => Promise<AnalisisIA>;
  guardar: (a: Analisis, dir?: string) => Promise<void>;
}

export const etapasReales: Etapas = {
  descargar: descargarVideo,
  extraerAudio,
  extraerFrames,
  transcribir,
  analizar: analizarContenido,
  guardar: guardarAnalisis,
};

/** Pipeline completo URL → Analisis, emitiendo progreso. `dirTmp` es la carpeta de trabajo transitoria. */
export async function* ejecutarPipeline(
  url: string,
  etapas: Etapas = etapasReales,
  dirTmp = "./.tmp-pipeline",
): AsyncGenerator<EventoPipeline> {
  const plataforma = detectarPlataforma(url);
  const dir = `${dirTmp}/${slugDeUrl(url)}`;
  try {
    yield { tipo: "progreso", fase: "descargar", mensaje: "Descargando video…" };
    const { rutaVideo, metadata } = await etapas.descargar(url, dir);

    yield { tipo: "progreso", fase: "extraer", mensaje: "Extrayendo audio y fotogramas…" };
    const audio = await etapas.extraerAudio(rutaVideo, dir);
    const frames = await etapas.extraerFrames(rutaVideo, dir, metadata.duracion).catch(() => []);

    yield { tipo: "progreso", fase: "transcribir", mensaje: "Transcribiendo con Whisper…" };
    const transcript = await etapas.transcribir(audio);

    yield { tipo: "progreso", fase: "analizar", mensaje: "Analizando con Claude…" };
    let ultimoParcial: Partial<AnalisisIA> = {};
    const analisisIA = await etapas.analizar(
      { meta: metadata, transcript, plataforma, frames },
      (p) => { ultimoParcial = p; },
    );
    yield { tipo: "parcial", parcial: ultimoParcial };

    yield { tipo: "progreso", fase: "guardar", mensaje: "Guardando…" };
    const analisis: Analisis = {
      id: slugDeUrl(url), url, plataforma, metadata, transcript,
      analisis: analisisIA, fechaAnalisis: new Date().toISOString(), version: 1,
    };
    await etapas.guardar(analisis);

    yield { tipo: "completado", analisis };
  } catch (e) {
    yield { tipo: "error", mensaje: e instanceof Error ? e.message : String(e) };
  }
}
```

> Nota: el test emite `parcial` justo después de `analizar`. La implementación captura el último parcial del callback y lo emite tras la etapa — coincide con el orden esperado del test.

- [ ] **Step 4: Tests en verde + commit**

Run: `pnpm vitest run src/lib/pipeline/orquestador.test.ts`
Expected: PASS (2 tests).
```bash
git add src/lib/pipeline/orquestador.ts src/lib/pipeline/orquestador.test.ts
git commit -m "feat: orquestador del pipeline (async generator + eventos)"
```

---

### Task 10: API `POST /api/analizar` (SSE)

**Files:**
- Create: `src/app/api/analizar/route.ts`

- [ ] **Step 1: Implementar la ruta**

Create `src/app/api/analizar/route.ts`:
```ts
import { ejecutarPipeline } from "@/lib/pipeline/orquestador";

export const runtime = "nodejs";
export const maxDuration = 800; // local; sin límite real

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url || !/^https?:\/\//.test(url)) {
    return Response.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY || !process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "Faltan claves. Configura ANTHROPIC_API_KEY y GROQ_API_KEY en .env.local" },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (ev: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        for await (const ev of ejecutarPipeline(url)) enviar(ev);
      } catch (e) {
        enviar({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Smoke sin claves**

Run (con `.env.local` sin claves):
```bash
curl -s -X POST http://localhost:3000/api/analizar -H "Content-Type: application/json" -d '{"url":"https://youtu.be/abc"}'
```
Expected: `{"error":"Faltan claves..."}` con HTTP 503.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analizar/route.ts
git commit -m "feat: endpoint /api/analizar con streaming SSE"
```

---

### Task 11: API `GET /api/biblioteca` + `GET /api/analisis/[id]`

**Files:**
- Create: `src/app/api/biblioteca/route.ts`
- Create: `src/app/api/analisis/[id]/route.ts`

- [ ] **Step 1: Implementar listado**

Create `src/app/api/biblioteca/route.ts`:
```ts
import { listarAnalisis } from "@/lib/storage/disco";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await listarAnalisis());
}
```

- [ ] **Step 2: Implementar detalle**

Create `src/app/api/analisis/[id]/route.ts`:
```ts
import { leerAnalisis } from "@/lib/storage/disco";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await leerAnalisis(id);
  return a ? Response.json(a) : Response.json({ error: "No encontrado" }, { status: 404 });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/biblioteca/route.ts src/app/api/analisis/
git commit -m "feat: endpoints de biblioteca y detalle de análisis"
```

---

### Task 12: UI — Home con formulario de URL

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/globals.css` (ya existe de create-next-app; solo aseguramos Tailwind)

- [ ] **Step 1: Implementar la home**

Replace `src/app/page.tsx`:
```tsx
import Link from "next/link";
import { FormularioAnalisis } from "@/components/formulario-analisis";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">
        Content<span className="text-sky-500">OS</span>
      </h1>
      <p className="mt-2 text-zinc-500">
        El video es el kernel. Pega un link y construye lo que quieras.
      </p>
      <div className="mt-8">
        <FormularioAnalisis />
      </div>
      <Link href="/biblioteca" className="mt-6 inline-block text-sm text-sky-600 hover:underline">
        Ver biblioteca →
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Commit (se completa en Task 13 con el componente)**

```bash
git add src/app/page.tsx
git commit -m "feat: home de ContentOS"
```

---

### Task 13: UI — Formulario + resultados en streaming

**Files:**
- Create: `src/components/formulario-analisis.tsx`
- Create: `src/components/resultado-analisis.tsx`

- [ ] **Step 1: Componente de resultados (presentación de los 15 + transcript)**

Create `src/components/resultado-analisis.tsx`:
```tsx
"use client";
import type { AnalisisIA } from "@/lib/analisis/esquema";

const SECCIONES: { clave: keyof AnalisisIA; titulo: string }[] = [
  { clave: "resumen", titulo: "Resumen" },
  { clave: "hooks", titulo: "Hooks & momentos virales" },
  { clave: "estructura", titulo: "Estructura" },
  { clave: "estrategia", titulo: "Estrategia" },
  { clave: "arcoEmocional", titulo: "Arco emocional" },
  { clave: "estiloVisual", titulo: "Estilo visual" },
  { clave: "musica", titulo: "Música & sonido" },
  { clave: "audiencia", titulo: "Audiencia" },
  { clave: "seo", titulo: "SEO & hashtags" },
  { clave: "ideasContenido", titulo: "Ideas de contenido" },
  { clave: "repurposing", titulo: "Plan de repurposing" },
  { clave: "guion", titulo: "Guion" },
  { clave: "contextoGeneracion", titulo: "Contexto para generación" },
  { clave: "promptsImagen", titulo: "Prompts de imagen" },
  { clave: "promptsVideo", titulo: "Prompts de video" },
];

export function ResultadoAnalisis({ datos }: { datos: Partial<AnalisisIA> }) {
  return (
    <div className="space-y-4">
      {SECCIONES.map(({ clave, titulo }) => {
        const valor = datos[clave];
        if (valor === undefined) return null;
        return (
          <section key={clave} className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-sky-600">{titulo}</h3>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-700">
              {typeof valor === "string" ? valor : JSON.stringify(valor, null, 2)}
            </pre>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Formulario que consume el SSE**

Create `src/components/formulario-analisis.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { AnalisisIA } from "@/lib/analisis/esquema";
import { ResultadoAnalisis } from "./resultado-analisis";

export function FormularioAnalisis() {
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [parcial, setParcial] = useState<Partial<AnalisisIA>>({});
  const [cargando, setCargando] = useState(false);

  async function analizar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setParcial({}); setEstado("Iniciando…"); setCargando(true);

    const res = await fetch("/api/analizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({ error: "Error de red" }));
      setError(j.error ?? "Error"); setCargando(false); setEstado("");
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const trozos = buffer.split("\n\n");
      buffer = trozos.pop() ?? "";
      for (const t of trozos) {
        const linea = t.replace(/^data: /, "").trim();
        if (!linea) continue;
        const ev = JSON.parse(linea);
        if (ev.tipo === "progreso") setEstado(ev.mensaje);
        else if (ev.tipo === "parcial") setParcial(ev.parcial);
        else if (ev.tipo === "completado") { setParcial(ev.analisis.analisis); setEstado("¡Listo!"); }
        else if (ev.tipo === "error") setError(ev.mensaje);
      }
    }
    setCargando(false);
  }

  return (
    <div>
      <form onSubmit={analizar} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tiktok.com/… o youtube.com/…"
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2"
        />
        <button
          disabled={cargando || !url}
          className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {cargando ? "Analizando…" : "Analizar"}
        </button>
      </form>

      {estado && <p className="mt-3 text-sm text-zinc-500">{estado}</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6">
        <ResultadoAnalisis datos={parcial} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
Expected: limpio.
```bash
git add src/components/
git commit -m "feat: formulario de análisis con streaming + render de resultados"
```

---

### Task 14: UI — Biblioteca y verificación end-to-end

**Files:**
- Create: `src/app/biblioteca/page.tsx`

- [ ] **Step 1: Página de biblioteca**

Create `src/app/biblioteca/page.tsx`:
```tsx
import Link from "next/link";
import { listarAnalisis } from "@/lib/storage/disco";

export const dynamic = "force-dynamic";

export default async function Biblioteca() {
  const items = await listarAnalisis();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-sky-600 hover:underline">← Inicio</Link>
      <h1 className="mt-4 text-3xl font-extrabold">Biblioteca</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-zinc-500">Aún no has analizado nada.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-zinc-200 p-4">
              <p className="font-medium">{a.titulo}</p>
              <p className="text-xs text-zinc-500">
                {a.plataforma} · {new Date(a.fechaAnalisis).toLocaleString("es")}
              </p>
              <a href={a.url} target="_blank" rel="noreferrer"
                 className="text-xs text-sky-600 hover:underline">{a.url}</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/biblioteca/page.tsx
git commit -m "feat: página de biblioteca"
```

- [ ] **Step 3: Verificación end-to-end (Antonio, en su navegador)**

1. Comprobar binarios: el comando `yt-dlp --version` y `ffmpeg -version` responden. Si no, instalar (`winget install yt-dlp.yt-dlp` y `winget install Gyan.FFmpeg`).
2. Crear `.env.local` con `ANTHROPIC_API_KEY` y `GROQ_API_KEY` reales.
3. `pnpm dev`, abrir http://localhost:3000.
4. Pegar una URL **corta de YouTube** (1–2 min) y pulsar Analizar.
5. Observar: progreso fase a fase (Descargando → Extrayendo → Transcribiendo → Analizando → Guardando) y luego los 15 bloques poblados.
6. Ir a `/biblioteca` y confirmar que el análisis aparece. Recargar para confirmar persistencia (`data/<id>.json`).
7. Probar una URL de **TikTok** y una de **Instagram Reel** público; anotar cuáles fallan (se resolverá con fallback Apify en una fase posterior).

- [ ] **Step 4: Suite completa + commit final**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add -A
git commit -m "chore: verificación F1 MVP core completa"
```

---

## Self-Review (cobertura del spec)

- **§3 Plataformas** → Task 2 (detección). Fallbacks Apify/RapidAPI quedan fuera de F1 (anotado en §13 del spec como mejora; la detección ya distingue plataformas para enrutar fallback futuro).
- **§4 Pipeline** → Tasks 5–9 (descarga, media, transcripción, análisis, orquestador). Cola BullMQ/Redis: deferido a F4 por decisión explícita (un video a la vez).
- **§5 Los 16 análisis** → transcript (Whisper, Task 7) + 15 campos del esquema (Task 3) generados en Task 8. Cobertura completa A–P.
- **§6 Diferenciadores (chat, multi-video, nicho, bulk, calendario)** → F2/F4, fuera de F1 por alcance acordado.
- **§7 Hub de generación** → F3. En F1 Claude solo produce el *texto* de promptsImagen/promptsVideo (sin llamadas a APIs externas).
- **§9 Stack** → Task 0 (Next + AI SDK + groq-sdk + zod + vitest). SQLite deferido a F2.
- **§10 Flujo de datos** → orquestador (Task 9) + SSE (Task 10) reflejan el flujo, sin la parte de cola.
- **§11 Modelo de datos** → `Analisis` en Task 4 coincide con el spec (id, url, plataforma, metadata, transcript, analisis, fechaAnalisis). El campo `generaciones[]` y `nicho_tags[]` del spec son de fases posteriores: omitidos en F1.
- **§12 Errores** → URL inválida (Task 10, 400), claves ausentes (Task 10, 503), fallo de etapa (orquestador emite `error`, Task 9). Retries/chunking/fallbacks: fases posteriores.
- **§15 Principios** → lógica pura testeada (Tasks 1–9), todo pasa por `/api/*` (Tasks 10–11), gratis-first (Groq Whisper; Claude es la excepción justificada), modular y local-first.

**Verificación de tipos cruzados:** `Analisis`, `AnalisisIA`, `Transcript`, `MetadataVideo`, `VideoDescargado`, `Etapas`, `EventoPipeline` se definen una vez y se reutilizan; los nombres de campo del esquema Zod (camelCase) coinciden en esquema, storage, orquestador y UI. La transcripción (`A`) viene de Whisper y los 15 restantes del esquema → 16 análisis totales, consistente con el spec.

**Pendiente conocido (anotado, no bloquea F1):** extended thinking en el análisis está desactivado en F1 (fricción SDK con salida estructurada); reactivar cuando se valide compatibilidad.
