# ContentOS F2 — Biblioteca, Búsqueda y Chat: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar tarea a tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Convertir la biblioteca de análisis (F1) en algo navegable, buscable y conversable: detalle por análisis, búsqueda full-text con SQLite/FTS5 y chat con el video (Gemini gratis).

**Architecture:** Los `data/<id>.json` siguen siendo la fuente de verdad. Se añade un índice SQLite **derivado y reconstruible** (`node:sqlite` integrado de Node 25 + FTS5) para búsqueda; el chat reutiliza el router de proveedor gratis-first (`modeloAnalisis()`) con `streamText`. Toda la lógica pura (proyección a documento, saneado de consulta, contexto del chat) se testea; las operaciones SQLite se testean con base `:memory:`; las llamadas al LLM se verifican a mano.

**Tech Stack:** Next.js 16 (App Router, TS, Tailwind) · `node:sqlite` (FTS5) · `ai` v6 (`streamText`) · `@ai-sdk/google`/`@ai-sdk/anthropic` (ya instalados) · `vitest`.

**Decisiones (resumen del spec):**
- **`node:sqlite` integrado**, no `better-sqlite3` (Node 25 sin prebuilds → riesgo de compilación). Verificado en vivo: `DatabaseSync`, FTS5, `bm25`, `snippet`, tokenizer `unicode61 remove_diacritics 2` funcionan.
- **JSON canónico, índice derivado.** Indexado best-effort al guardar; auto-reparación (`reindexarTodo`) si el índice está vacío.
- **Chat gratis-first** reutilizando `modeloAnalisis()`. UI de streaming con el patrón manual `fetch`+reader ya presente en `formulario-analisis.tsx` (sin añadir `@ai-sdk/react`).

**File Structure:**
- Create `src/lib/storage/indice.ts` — `DocIndice`, `ResultadoBusqueda`, `aDocumento`, `sanitizarConsultaFts`, `abrirIndice`, `reindexarTodo`, `IndiceDB`.
- Create `src/lib/storage/indice.test.ts`.
- Create `src/lib/storage/persistir.ts` — `persistirAnalisis` (JSON + índice).
- Modify `src/lib/pipeline/orquestador.ts` — `etapasReales.guardar = persistirAnalisis`.
- Modify `src/app/api/biblioteca/route.ts` — soporta `?q=`.
- Create `src/components/vista-analisis.tsx` — renderer legible compartido (sin `"use client"`).
- Modify `src/components/resultado-analisis.tsx` — reutiliza el renderer compartido.
- Create `src/components/buscador-biblioteca.tsx` (client) — input con debounce.
- Modify `src/app/biblioteca/page.tsx` — monta el buscador, enlaces a detalle.
- Create `src/lib/chat/contexto.ts` + `src/lib/chat/contexto.test.ts`.
- Create `src/lib/chat/responder.ts` — `responderChat` (streamText).
- Create `src/app/api/chat/route.ts`.
- Create `src/components/chat-video.tsx` (client).
- Create `src/app/biblioteca/[id]/page.tsx` — detalle + chat.
- Create `scripts/reindexar.ts` — reindex manual.

---

### Task 0: Rama de feature + baseline verde

**Files:** ninguno (git).

- [ ] **Step 1: Crear rama desde main**

```bash
cd /c/Workspace/contentos
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b feature/f2-biblioteca-chat
```

- [ ] **Step 2: Confirmar baseline**

Run: `pnpm test && pnpm typecheck`
Expected: 31 tests PASS, typecheck limpio.

---

### Task 1: `aDocumento` + tipos del índice (puro)

**Files:**
- Create: `src/lib/storage/indice.ts`
- Test: `src/lib/storage/indice.test.ts`

- [ ] **Step 1: Test**

Create `src/lib/storage/indice.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { aDocumento } from "./indice";
import type { Analisis } from "./tipos";

const base: Analisis = {
  id: "abc123", url: "https://youtu.be/x", plataforma: "youtube",
  metadata: { titulo: "Cómo ahorrar", autor: "Finanzas", duracion: 60 },
  transcript: { texto: "Hoy hablo de pricing", idioma: "es", segmentos: [] },
  analisis: {
    resumen: "Trata de ahorro", hooks: [], ideasContenido: [], estrategia: "e",
    contextoGeneracion: "c", estructura: [], guion: "g", estiloVisual: "v",
    musica: "m", arcoEmocional: [], seo: { keywords: ["pricing", "ahorro"], hashtags: ["#dinero"] },
    audiencia: "a", repurposing: [], promptsImagen: [], promptsVideo: [],
  },
  fechaAnalisis: "2026-06-14T00:00:00.000Z", version: 1,
};

describe("aDocumento", () => {
  it("proyecta los campos buscables del Analisis", () => {
    const d = aDocumento(base);
    expect(d.id).toBe("abc123");
    expect(d.titulo).toBe("Cómo ahorrar");
    expect(d.autor).toBe("Finanzas");
    expect(d.plataforma).toBe("youtube");
    expect(d.fecha).toBe("2026-06-14T00:00:00.000Z");
    expect(d.resumen).toBe("Trata de ahorro");
    expect(d.transcript).toBe("Hoy hablo de pricing");
  });
  it("une keywords y hashtags por espacios", () => {
    const d = aDocumento(base);
    expect(d.keywords).toBe("pricing ahorro");
    expect(d.hashtags).toBe("#dinero");
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/storage/indice.test.ts`
Expected: FAIL — módulo/`aDocumento` inexistente.

- [ ] **Step 3: Implementar (parte 1 de indice.ts)**

Create `src/lib/storage/indice.ts`:
```ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Analisis } from "./tipos";

const DIR_POR_DEFECTO = process.env.CONTENTOS_DATA_DIR || "./data";

export interface DocIndice {
  id: string;
  url: string;
  titulo: string;
  autor: string;
  plataforma: string;
  fecha: string;        // ISO (fechaAnalisis)
  resumen: string;
  transcript: string;
  keywords: string;     // unidas por espacio
  hashtags: string;     // unidos por espacio
}

export interface ResultadoBusqueda {
  id: string;
  titulo: string;
  plataforma: string;
  url: string;
  fechaAnalisis: string;
  snippet: string;
}

/** Proyección pura Analisis -> documento indexable. */
export function aDocumento(a: Analisis): DocIndice {
  return {
    id: a.id,
    url: a.url,
    titulo: a.metadata.titulo,
    autor: a.metadata.autor,
    plataforma: a.plataforma,
    fecha: a.fechaAnalisis,
    resumen: a.analisis.resumen,
    transcript: a.transcript.texto,
    keywords: a.analisis.seo.keywords.join(" "),
    hashtags: a.analisis.seo.hashtags.join(" "),
  };
}
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/storage/indice.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/indice.ts src/lib/storage/indice.test.ts
git commit -m "feat: proyección Analisis -> documento de índice (puro)"
```

---

### Task 2: `sanitizarConsultaFts` (puro)

**Files:**
- Modify: `src/lib/storage/indice.ts`
- Test: `src/lib/storage/indice.test.ts`

- [ ] **Step 1: Añadir tests**

Añade a `src/lib/storage/indice.test.ts` (nuevo bloque al final, y añade `sanitizarConsultaFts` al import existente):
```ts
import { aDocumento, sanitizarConsultaFts } from "./indice";

describe("sanitizarConsultaFts", () => {
  it("devuelve '' para entrada vacía o solo símbolos", () => {
    expect(sanitizarConsultaFts("")).toBe("");
    expect(sanitizarConsultaFts('  () "" *  ')).toBe("");
  });
  it("convierte cada palabra en token con prefijo y comillas", () => {
    expect(sanitizarConsultaFts("Hola Mundo")).toBe('"hola"* "mundo"*');
  });
  it("ignora caracteres especiales de FTS5", () => {
    expect(sanitizarConsultaFts('pricing(2)')).toBe('"pricing"* "2"*');
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/storage/indice.test.ts`
Expected: FAIL — `sanitizarConsultaFts` no exportada.

- [ ] **Step 3: Implementar (añadir a indice.ts tras `aDocumento`)**

```ts
/** Convierte input libre del usuario en una consulta MATCH de FTS5 segura.
 *  Cada palabra se vuelve un token con prefijo (`*`) entre comillas (AND implícito). */
export function sanitizarConsultaFts(q: string): string {
  const tokens = q
    .toLowerCase()
    .replace(/["()*]/g, " ") // quita caracteres especiales de la sintaxis FTS5
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"*`).join(" ");
}
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/storage/indice.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/indice.ts src/lib/storage/indice.test.ts
git commit -m "feat: saneado de consulta para FTS5 (puro)"
```

---

### Task 3: Índice SQLite (`node:sqlite` + FTS5)

**Files:**
- Modify: `src/lib/storage/indice.ts`
- Test: `src/lib/storage/indice.test.ts`

- [ ] **Step 1: Añadir tests con base `:memory:`**

Añade a `src/lib/storage/indice.test.ts` (y añade `abrirIndice` al import):
```ts
import { aDocumento, sanitizarConsultaFts, abrirIndice } from "./indice";
import type { DocIndice } from "./indice";

function doc(over: Partial<DocIndice>): DocIndice {
  return {
    id: "id1", url: "http://a", titulo: "Título", autor: "Autor", plataforma: "youtube",
    fecha: "2026-06-14T00:00:00.000Z", resumen: "resumen", transcript: "transcripción",
    keywords: "", hashtags: "", ...over,
  };
}

describe("IndiceDB (:memory:)", () => {
  it("indexa y encuentra por palabra del título (insensible a acentos)", () => {
    const db = abrirIndice(":memory:");
    db.indexar(doc({ id: "id1", titulo: "Cómo ahorrar dinero" }));
    expect(db.buscar("como").map((r) => r.id)).toEqual(["id1"]);
    expect(db.buscar("ahorrar").map((r) => r.id)).toEqual(["id1"]);
    db.cerrar();
  });
  it("encuentra por transcripción y keywords, y devuelve snippet", () => {
    const db = abrirIndice(":memory:");
    db.indexar(doc({ id: "id1", transcript: "Hoy hablo de pricing en el minuto 3", keywords: "pricing" }));
    const r = db.buscar("pricing");
    expect(r).toHaveLength(1);
    expect(r[0].snippet).toContain("pricing");
    db.cerrar();
  });
  it("upsert: reindexar el mismo id no duplica", () => {
    const db = abrirIndice(":memory:");
    db.indexar(doc({ id: "id1", titulo: "v1" }));
    db.indexar(doc({ id: "id1", titulo: "v2 actualizado" }));
    expect(db.contar()).toBe(1);
    expect(db.buscar("actualizado").map((r) => r.id)).toEqual(["id1"]);
    db.cerrar();
  });
  it("buscar con consulta vacía devuelve []", () => {
    const db = abrirIndice(":memory:");
    db.indexar(doc({ id: "id1" }));
    expect(db.buscar("   ")).toEqual([]);
    db.cerrar();
  });
  it("reindexarDesde limpia y reconstruye", () => {
    const db = abrirIndice(":memory:");
    db.indexar(doc({ id: "viejo", titulo: "viejo" }));
    const n = db.reindexarDesde([doc({ id: "a", titulo: "alfa" }), doc({ id: "b", titulo: "beta" })]);
    expect(n).toBe(2);
    expect(db.contar()).toBe(2);
    expect(db.buscar("viejo")).toEqual([]);
    expect(db.buscar("alfa").map((r) => r.id)).toEqual(["a"]);
    db.cerrar();
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/storage/indice.test.ts`
Expected: FAIL — `abrirIndice` no exportada.

- [ ] **Step 3: Implementar (añadir a indice.ts tras `sanitizarConsultaFts`)**

```ts
const ESQUEMA = `CREATE VIRTUAL TABLE IF NOT EXISTS analisis_fts USING fts5(
  titulo, autor, resumen, transcript, keywords, hashtags,
  id UNINDEXED, url UNINDEXED, plataforma UNINDEXED, fecha UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);`;

export interface IndiceDB {
  indexar(doc: DocIndice): void;
  buscar(q: string, limite?: number): ResultadoBusqueda[];
  reindexarDesde(docs: DocIndice[]): number;
  contar(): number;
  cerrar(): void;
}

function crearIndiceDB(rutaDb: string): IndiceDB {
  const db = new DatabaseSync(rutaDb);
  db.exec(ESQUEMA);

  const stmtInsert = db.prepare(
    `INSERT INTO analisis_fts (titulo,autor,resumen,transcript,keywords,hashtags,id,url,plataforma,fecha)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  const stmtDelete = db.prepare(`DELETE FROM analisis_fts WHERE id = ?`);
  const stmtBuscar = db.prepare(
    `SELECT id, titulo, plataforma, url, fecha,
            snippet(analisis_fts, 3, '[', ']', '…', 10) AS snippet
       FROM analisis_fts
      WHERE analisis_fts MATCH ?
      ORDER BY bm25(analisis_fts)
      LIMIT ?`,
  );
  const stmtContar = db.prepare(`SELECT count(*) AS c FROM analisis_fts`);

  function insertar(d: DocIndice) {
    stmtInsert.run(
      d.titulo, d.autor, d.resumen, d.transcript, d.keywords, d.hashtags,
      d.id, d.url, d.plataforma, d.fecha,
    );
  }

  return {
    indexar(d) {
      stmtDelete.run(d.id); // upsert: borra el anterior si existía
      insertar(d);
    },
    buscar(q, limite = 20) {
      const match = sanitizarConsultaFts(q);
      if (!match) return [];
      try {
        const filas = stmtBuscar.all(match, limite) as Array<{
          id: string; titulo: string; plataforma: string; url: string; fecha: string; snippet: string;
        }>;
        return filas.map((f) => ({
          id: f.id, titulo: f.titulo, plataforma: f.plataforma, url: f.url,
          fechaAnalisis: f.fecha, snippet: f.snippet,
        }));
      } catch {
        return []; // consulta MATCH inválida → sin resultados, nunca rompe
      }
    },
    reindexarDesde(docs) {
      db.exec(`DELETE FROM analisis_fts`);
      for (const d of docs) insertar(d);
      return docs.length;
    },
    contar() {
      return (stmtContar.get() as { c: number }).c;
    },
    cerrar() {
      db.close();
    },
  };
}

let singleton: IndiceDB | null = null;

/** Abre el índice. Sin ruta → singleton sobre data/contentos.db. Con ruta → instancia nueva (tests). */
export function abrirIndice(rutaDb?: string): IndiceDB {
  if (rutaDb !== undefined) return crearIndiceDB(rutaDb);
  if (!singleton) {
    mkdirSync(DIR_POR_DEFECTO, { recursive: true });
    singleton = crearIndiceDB(join(DIR_POR_DEFECTO, "contentos.db"));
  }
  return singleton;
}

/** Reconstruye el índice leyendo todos los data/*.json. Devuelve nº indexados. */
export function reindexarTodo(dir = DIR_POR_DEFECTO, db = abrirIndice()): number {
  let archivos: string[];
  try {
    archivos = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return 0;
  }
  const docs: DocIndice[] = [];
  for (const f of archivos) {
    try {
      const a = JSON.parse(readFileSync(join(dir, f), "utf8")) as Analisis;
      docs.push(aDocumento(a));
    } catch { /* ignora corruptos */ }
  }
  return db.reindexarDesde(docs);
}
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/storage/indice.test.ts`
Expected: PASS (10 tests). Puede aparecer `ExperimentalWarning: SQLite is an experimental feature` — es esperado e inofensivo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/indice.ts src/lib/storage/indice.test.ts
git commit -m "feat: índice de búsqueda SQLite/FTS5 con node:sqlite"
```

---

### Task 4: `persistirAnalisis` + cableado del orquestador

**Files:**
- Create: `src/lib/storage/persistir.ts`
- Modify: `src/lib/pipeline/orquestador.ts`

- [ ] **Step 1: Implementar `persistir.ts`**

Create `src/lib/storage/persistir.ts`:
```ts
import { guardarAnalisis } from "./disco";
import { abrirIndice, aDocumento } from "./indice";
import type { Analisis } from "./tipos";

/** Guarda el JSON (fuente de verdad) y actualiza el índice (best-effort, no-fatal). */
export async function persistirAnalisis(a: Analisis, dir?: string): Promise<void> {
  await guardarAnalisis(a, dir);
  try {
    abrirIndice().indexar(aDocumento(a));
  } catch (e) {
    console.error("[contentos] No se pudo indexar el análisis:", (e as Error).message);
  }
}
```

- [ ] **Step 2: Cablear en el orquestador**

En `src/lib/pipeline/orquestador.ts`, reemplaza el import de `guardarAnalisis` para `etapasReales` por `persistirAnalisis` y úsalo:

Cambia la línea de import:
```ts
import { guardarAnalisis, slugDeUrl } from "@/lib/storage/disco";
```
por:
```ts
import { slugDeUrl } from "@/lib/storage/disco";
import { persistirAnalisis } from "@/lib/storage/persistir";
```

Y en `etapasReales`, cambia:
```ts
  guardar: guardarAnalisis,
```
por:
```ts
  guardar: persistirAnalisis,
```

- [ ] **Step 3: Verificar que el test del orquestador sigue verde**

Run: `pnpm vitest run src/lib/pipeline/orquestador.test.ts`
Expected: PASS (2 tests) — usa `etapasFake.guardar`, no se ve afectado.

- [ ] **Step 4: typecheck + commit**

Run: `pnpm typecheck`
Expected: limpio.
```bash
git add src/lib/storage/persistir.ts src/lib/pipeline/orquestador.ts
git commit -m "feat: persistir = guardar JSON + indexar (best-effort) en el pipeline"
```

---

### Task 5: API `GET /api/biblioteca?q=` (lista o busca, self-heal)

**Files:**
- Modify: `src/app/api/biblioteca/route.ts`

- [ ] **Step 1: Implementar**

Replace `src/app/api/biblioteca/route.ts`:
```ts
import { listarAnalisis } from "@/lib/storage/disco";
import { abrirIndice, reindexarTodo } from "@/lib/storage/indice";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json(await listarAnalisis());
  const db = abrirIndice();
  if (db.contar() === 0) reindexarTodo(); // self-heal: indexa los JSON ya existentes
  return Response.json(db.buscar(q));
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/biblioteca/route.ts
git commit -m "feat: /api/biblioteca soporta búsqueda full-text (?q=)"
```

---

### Task 6: Renderer legible compartido `vista-analisis.tsx`

**Files:**
- Create: `src/components/vista-analisis.tsx`
- Modify: `src/components/resultado-analisis.tsx`

> Sin `"use client"`: es presentacional puro, lo usan tanto un server component (detalle) como un client component (streaming).

- [ ] **Step 1: Crear el renderer**

Create `src/components/vista-analisis.tsx`:
```tsx
import type { AnalisisIA } from "@/lib/analisis/esquema";

export const SECCIONES: { clave: keyof AnalisisIA; titulo: string }[] = [
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

export function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-sky-600">{titulo}</h3>
      {children}
    </section>
  );
}

const parrafo = "whitespace-pre-wrap break-words text-sm text-zinc-700";

/** Renderiza el valor de una clave del análisis con formato adecuado a su forma.
 *  Tolerante a datos parciales (streaming): cualquier campo puede faltar. */
export function ContenidoSeccion({ clave, valor }: { clave: keyof AnalisisIA; valor: unknown }) {
  if (valor == null) return null;

  if (typeof valor === "string") return <p className={parrafo}>{valor}</p>;

  if (clave === "seo") {
    const v = valor as AnalisisIA["seo"];
    const chips = (xs: string[] | undefined, cls: string) =>
      (xs ?? []).filter(Boolean).map((x, i) => (
        <span key={i} className={`mr-1 mb-1 inline-block rounded-full px-2 py-0.5 text-xs ${cls}`}>{x}</span>
      ));
    return (
      <div>
        <div className="mb-1">{chips(v?.keywords, "bg-zinc-100 text-zinc-700")}</div>
        <div>{chips(v?.hashtags, "bg-sky-100 text-sky-700")}</div>
      </div>
    );
  }

  if (Array.isArray(valor)) {
    return (
      <ul className="space-y-2">
        {valor.filter(Boolean).map((item, i) => (
          <li key={i} className="text-sm text-zinc-700">{lineaItem(clave, item as Record<string, unknown>)}</li>
        ))}
      </ul>
    );
  }

  return <pre className={parrafo}>{JSON.stringify(valor, null, 2)}</pre>;
}

function lineaItem(clave: keyof AnalisisIA, item: Record<string, unknown>): React.ReactNode {
  const s = (k: string) => (typeof item[k] === "string" ? (item[k] as string) : "");
  switch (clave) {
    case "hooks":
      return <><b>{s("timestamp")}</b> «{s("texto")}» — <i>{s("porqueFunciona")}</i></>;
    case "estructura":
      return <><b>[{s("inicio")}–{s("fin")}] {s("etiqueta")}:</b> {s("resumen")}</>;
    case "arcoEmocional":
      return <><b>{s("timestamp")}</b> {s("emocion")} ({String(item["intensidad"] ?? "")}/10)</>;
    case "ideasContenido":
    case "repurposing":
      return <><b>{s("formato")} · {s("titulo")}:</b> {s("descripcion")}</>;
    case "promptsImagen":
    case "promptsVideo":
      return <><b>{s("escena")}</b> ({s("herramientaSugerida")}): {s("prompt")}</>;
    default:
      return <pre className={parrafo}>{JSON.stringify(item, null, 2)}</pre>;
  }
}

/** Vista completa de un análisis (los 15 bloques) para la página de detalle. */
export function VistaAnalisis({ analisis }: { analisis: AnalisisIA }) {
  return (
    <div className="space-y-4">
      {SECCIONES.map(({ clave, titulo }) => (
        <Bloque key={clave} titulo={titulo}>
          <ContenidoSeccion clave={clave} valor={analisis[clave]} />
        </Bloque>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Refactorizar `resultado-analisis.tsx` para reutilizar el renderer**

Replace `src/components/resultado-analisis.tsx`:
```tsx
"use client";
import type { AnalisisIA } from "@/lib/analisis/esquema";
import { SECCIONES, Bloque, ContenidoSeccion } from "./vista-analisis";

export function ResultadoAnalisis({ datos }: { datos: Partial<AnalisisIA> }) {
  return (
    <div className="space-y-4">
      {SECCIONES.map(({ clave, titulo }) => {
        const valor = datos[clave];
        if (valor === undefined) return null;
        return (
          <Bloque key={clave} titulo={titulo}>
            <ContenidoSeccion clave={clave} valor={valor} />
          </Bloque>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add src/components/vista-analisis.tsx src/components/resultado-analisis.tsx
git commit -m "feat: renderer legible de análisis compartido (detalle + streaming)"
```

---

### Task 7: Buscador en la biblioteca + enlaces a detalle

**Files:**
- Create: `src/components/buscador-biblioteca.tsx`
- Modify: `src/app/biblioteca/page.tsx`

- [ ] **Step 1: Componente buscador (client, debounce)**

Create `src/components/buscador-biblioteca.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export interface ItemBiblioteca {
  id: string;
  titulo: string;
  plataforma: string;
  url: string;
  fechaAnalisis: string;
  snippet?: string;
}

export function BuscadorBiblioteca({ iniciales }: { iniciales: ItemBiblioteca[] }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ItemBiblioteca[]>(iniciales);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setItems(iniciales); return; }
      setCargando(true);
      const res = await fetch(`/api/biblioteca?q=${encodeURIComponent(q)}`);
      setItems(res.ok ? await res.json() : []);
      setCargando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, iniciales]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por título, transcripción, keywords…"
        className="w-full rounded-lg border border-zinc-300 px-4 py-2"
      />
      {cargando && <p className="mt-2 text-sm text-zinc-400">Buscando…</p>}
      {items.length === 0 ? (
        <p className="mt-6 text-zinc-500">{q.trim() ? "Sin resultados." : "Aún no has analizado nada."}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-zinc-200 p-4">
              <Link href={`/biblioteca/${a.id}`} className="font-medium text-sky-700 hover:underline">
                {a.titulo}
              </Link>
              <p className="text-xs text-zinc-500">
                {a.plataforma} · {new Date(a.fechaAnalisis).toLocaleString("es")}
              </p>
              {a.snippet && <p className="mt-1 text-sm text-zinc-600">…{a.snippet}…</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Página de biblioteca usa el buscador**

Replace `src/app/biblioteca/page.tsx`:
```tsx
import Link from "next/link";
import { listarAnalisis } from "@/lib/storage/disco";
import { BuscadorBiblioteca, type ItemBiblioteca } from "@/components/buscador-biblioteca";

export const dynamic = "force-dynamic";

export default async function Biblioteca() {
  const iniciales: ItemBiblioteca[] = await listarAnalisis();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-sky-600 hover:underline">← Inicio</Link>
      <h1 className="mt-4 text-3xl font-extrabold">Biblioteca</h1>
      <div className="mt-6">
        <BuscadorBiblioteca iniciales={iniciales} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
Expected: limpio.
```bash
git add src/components/buscador-biblioteca.tsx src/app/biblioteca/page.tsx
git commit -m "feat: buscador en la biblioteca con enlaces a detalle"
```

---

### Task 8: Contexto del chat (puro)

**Files:**
- Create: `src/lib/chat/contexto.ts`
- Test: `src/lib/chat/contexto.test.ts`

- [ ] **Step 1: Test**

Create `src/lib/chat/contexto.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { construirContextoChat } from "./contexto";
import type { Analisis } from "@/lib/storage/tipos";

const base: Analisis = {
  id: "abc", url: "https://youtu.be/x", plataforma: "youtube",
  metadata: { titulo: "Cómo ahorrar", autor: "Finanzas", duracion: 60 },
  transcript: { texto: "Hoy hablo de pricing.", idioma: "es", segmentos: [] },
  analisis: {
    resumen: "Trata de ahorro y pricing.", hooks: [{ timestamp: "00:03", texto: "¿Sabías?", porqueFunciona: "curiosidad" }],
    ideasContenido: [], estrategia: "Problema-solución.", contextoGeneracion: "c",
    estructura: [{ etiqueta: "intro", inicio: "00:00", fin: "00:05", resumen: "saluda" }],
    guion: "g", estiloVisual: "v", musica: "m", arcoEmocional: [],
    seo: { keywords: [], hashtags: [] }, audiencia: "18-25 productividad", repurposing: [],
    promptsImagen: [], promptsVideo: [],
  },
  fechaAnalisis: "2026-06-14T00:00:00.000Z", version: 1,
};

describe("construirContextoChat", () => {
  it("incluye título, resumen, estrategia, audiencia y transcripción", () => {
    const c = construirContextoChat(base);
    expect(c).toContain("Cómo ahorrar");
    expect(c).toContain("Trata de ahorro y pricing.");
    expect(c).toContain("Problema-solución.");
    expect(c).toContain("18-25 productividad");
    expect(c).toContain("Hoy hablo de pricing.");
  });
  it("pide responder en español y ceñirse al contenido", () => {
    const c = construirContextoChat(base).toLowerCase();
    expect(c).toContain("español");
    expect(c).toContain("no aparece en el video");
  });
  it("trunca la transcripción si excede el máximo", () => {
    const larga = { ...base, transcript: { ...base.transcript, texto: "x".repeat(20000) } };
    const c = construirContextoChat(larga, { maxTranscript: 100 });
    expect(c).toContain("[…]");
    expect(c.length).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Ejecutar (falla)**

Run: `pnpm vitest run src/lib/chat/contexto.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Create `src/lib/chat/contexto.ts`:
```ts
import type { Analisis } from "@/lib/storage/tipos";

const MAX_TRANSCRIPT = 8000;

/** Construye el system prompt del chat a partir del análisis guardado. */
export function construirContextoChat(a: Analisis, opts?: { maxTranscript?: number }): string {
  const max = opts?.maxTranscript ?? MAX_TRANSCRIPT;
  const t = a.transcript.texto;
  const transcript = t.length > max ? t.slice(0, max) + " […]" : t;
  const an = a.analisis;
  const estructura = an.estructura
    .map((s) => `- [${s.inicio}–${s.fin}] ${s.etiqueta}: ${s.resumen}`)
    .join("\n");
  const hooks = an.hooks
    .map((h) => `- ${h.timestamp}: "${h.texto}" (${h.porqueFunciona})`)
    .join("\n");

  return [
    `Eres un asistente que responde preguntas SOBRE UN VIDEO YA ANALIZADO.`,
    `Responde SIEMPRE en español, de forma concreta y accionable.`,
    `Usa EXCLUSIVAMENTE la información de abajo (análisis + transcripción).`,
    `Si la respuesta no está en el contenido, dilo claramente: "Eso no aparece en el video".`,
    `Cuando puedas, cita el timestamp.`,
    ``,
    `# Video`,
    `Título: ${a.metadata.titulo}`,
    `Autor: ${a.metadata.autor}`,
    `Plataforma: ${a.plataforma}`,
    `Duración: ${a.metadata.duracion}s`,
    ``,
    `# Resumen`,
    an.resumen,
    ``,
    `# Estructura`,
    estructura || "(no disponible)",
    ``,
    `# Hooks`,
    hooks || "(no disponible)",
    ``,
    `# Estrategia`,
    an.estrategia,
    ``,
    `# Audiencia`,
    an.audiencia,
    ``,
    `# Transcripción`,
    transcript,
  ].join("\n");
}
```

- [ ] **Step 4: Tests en verde**

Run: `pnpm vitest run src/lib/chat/contexto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/contexto.ts src/lib/chat/contexto.test.ts
git commit -m "feat: contexto del chat desde el análisis guardado (puro)"
```

---

### Task 9: `responderChat` + API `POST /api/chat`

**Files:**
- Create: `src/lib/chat/responder.ts`
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Implementar `responder.ts`**

Create `src/lib/chat/responder.ts`:
```ts
import { streamText, type ModelMessage } from "ai";
import { modeloAnalisis } from "@/lib/analisis/proveedor";
import { construirContextoChat } from "./contexto";
import type { Analisis } from "@/lib/storage/tipos";

export interface MensajeChat {
  role: "user" | "assistant";
  content: string;
}

/** Responde en streaming usando el proveedor gratis-first (Gemini) y el análisis como contexto. */
export function responderChat(a: Analisis, mensajes: MensajeChat[]) {
  const { modelo } = modeloAnalisis();
  return streamText({
    model: modelo,
    system: construirContextoChat(a),
    messages: mensajes as ModelMessage[],
  });
}
```

- [ ] **Step 2: Implementar la ruta**

Create `src/app/api/chat/route.ts`:
```ts
import { leerAnalisis } from "@/lib/storage/disco";
import { proveedorElegido } from "@/lib/analisis/proveedor";
import { responderChat, type MensajeChat } from "@/lib/chat/responder";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { id, mensajes } = (await req.json()) as { id?: string; mensajes?: MensajeChat[] };
  if (!id || !Array.isArray(mensajes) || mensajes.length === 0) {
    return Response.json({ error: "Petición inválida" }, { status: 400 });
  }
  try {
    proveedorElegido(); // lanza si no hay clave de proveedor
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
  const a = await leerAnalisis(id);
  if (!a) return Response.json({ error: "No encontrado" }, { status: 404 });

  return responderChat(a, mensajes).toTextStreamResponse();
}
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: limpio. (Si `messages: mensajes as ModelMessage[]` se queja, confirma que `ModelMessage` se importa de `ai`.)

- [ ] **Step 4: Smoke sin clave (opcional, manual)**

Con `.env.local` temporalmente sin claves de proveedor:
```bash
curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"id":"x","mensajes":[{"role":"user","content":"hola"}]}'
```
Expected: `{"error":"Configura GOOGLE_GENERATIVE_AI_API_KEY ..."}` con HTTP 503.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/responder.ts src/app/api/chat/route.ts
git commit -m "feat: endpoint de chat con el video (streamText, gratis-first)"
```

---

### Task 10: UI del chat `chat-video.tsx`

**Files:**
- Create: `src/components/chat-video.tsx`

- [ ] **Step 1: Implementar (patrón fetch+reader como formulario-analisis)**

Create `src/components/chat-video.tsx`:
```tsx
"use client";
import { useState } from "react";

interface Msg { role: "user" | "assistant"; content: string; }

export function ChatVideo({ id }: { id: string }) {
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const pregunta = input.trim();
    if (!pregunta) return;
    setError(""); setInput(""); setCargando(true);

    const historial: Msg[] = [...mensajes, { role: "user", content: pregunta }];
    setMensajes([...historial, { role: "assistant", content: "" }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, mensajes: historial }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({ error: "Error de red" }));
      setError(j.error ?? "Error"); setMensajes(historial); setCargando(false);
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let acum = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acum += dec.decode(value, { stream: true });
      setMensajes([...historial, { role: "assistant", content: acum }]);
    }
    setCargando(false);
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-sky-600">Chat con el video</h2>
      {mensajes.length === 0 && (
        <p className="text-sm text-zinc-400">Pregunta lo que quieras sobre este video ya analizado.</p>
      )}
      <div className="space-y-3">
        {mensajes.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-sky-600 text-white" : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {m.content || "…"}
            </span>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={enviar} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿En qué minuto habla de…?"
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2"
        />
        <button
          disabled={cargando || !input.trim()}
          className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {cargando ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
Expected: limpio.
```bash
git add src/components/chat-video.tsx
git commit -m "feat: UI de chat con el video (streaming)"
```

---

### Task 11: Página de detalle `/biblioteca/[id]`

**Files:**
- Create: `src/app/biblioteca/[id]/page.tsx`

- [ ] **Step 1: Implementar**

Create `src/app/biblioteca/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { leerAnalisis } from "@/lib/storage/disco";
import { VistaAnalisis } from "@/components/vista-analisis";
import { ChatVideo } from "@/components/chat-video";

export const dynamic = "force-dynamic";

export default async function DetalleAnalisis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await leerAnalisis(id);
  if (!a) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/biblioteca" className="text-sm text-sky-600 hover:underline">← Biblioteca</Link>
      <h1 className="mt-4 text-3xl font-extrabold">{a.metadata.titulo}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {a.plataforma} · {a.metadata.autor} · {new Date(a.fechaAnalisis).toLocaleString("es")}
      </p>
      <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">
        {a.url}
      </a>

      <div className="mt-8">
        <VistaAnalisis analisis={a.analisis} />
      </div>

      <details className="mt-8 rounded-xl border border-zinc-200 p-4">
        <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-sky-600">
          Transcripción
        </summary>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{a.transcript.texto}</p>
      </details>

      <ChatVideo id={id} />
    </main>
  );
}
```

- [ ] **Step 2: typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
Expected: limpio.
```bash
git add "src/app/biblioteca/[id]/page.tsx"
git commit -m "feat: página de detalle navegable con análisis + transcripción + chat"
```

---

### Task 12: Script de reindex + verificación final

**Files:**
- Create: `scripts/reindexar.ts`

- [ ] **Step 1: Script de reindex manual**

Create `scripts/reindexar.ts`:
```ts
import { reindexarTodo } from "../src/lib/storage/indice";

const n = reindexarTodo();
console.log(`Reindexados ${n} análisis en el índice SQLite.`);
```

- [ ] **Step 2: Indexar los análisis de F1 ya existentes**

Run: `pnpm tsx scripts/reindexar.ts`
Expected: `Reindexados 2 análisis en el índice SQLite.` (los 2 JSON de F1). Crea `data/contentos.db`.

- [ ] **Step 3: Suite completa**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: todos los tests PASS (≈42), typecheck/lint limpios, build OK.

- [ ] **Step 4: Verificación E2E en navegador (Antonio o automode con Gemini gratis)**

1. `pnpm dev` (terminal con PATH de yt-dlp/ffmpeg/deno y `.env.local` con `GROQ_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY`).
2. Ir a `/biblioteca`: ver los 2 análisis de F1.
3. Buscar una palabra que aparezca en uno (p. ej. del título o transcripción) → la lista se filtra; ver snippet.
4. Clicar un resultado → `/biblioteca/[id]` muestra los 15 bloques legibles + transcripción plegable.
5. En el chat, preguntar "¿de qué trata el video?" y "¿en qué minuto habla de X?" → respuesta en streaming, fundamentada; preguntar algo ausente → responde "no aparece en el video".
6. (Opcional) Analizar un video nuevo desde la home y confirmar que aparece en la búsqueda sin reindexar a mano (indexado en escritura).

- [ ] **Step 5: Commit final**

```bash
git add scripts/reindexar.ts
git commit -m "chore: script de reindex + verificación F2"
```

---

## Self-Review (cobertura del spec)

- **§1/§2 Biblioteca navegable** → Task 11 (detalle `/biblioteca/[id]`) + Task 6 (renderer legible) + Task 7 (enlaces). ✓
- **§2 Búsqueda (SQLite/FTS5)** → Task 1–3 (índice), Task 5 (API `?q=`), Task 7 (buscador UI). ✓
- **§2 Chat con el video** → Task 8 (contexto), Task 9 (responder + API), Task 10 (UI), montado en Task 11. ✓
- **§3.1 node:sqlite + FTS5** → Task 3 (esquema FTS5, tokenizer sin acentos, bm25, snippet). ✓
- **§3.2 JSON canónico / índice derivado** → `aDocumento` (Task 1), `reindexarTodo` (Task 3), `persistir` (Task 4). ✓
- **§3.3 Indexado en escritura + self-heal** → Task 4 (persistir en orquestador) + Task 5 (`reindexarTodo` si índice vacío). ✓
- **§3.4 Chat gratis-first reutilizando el router** → Task 9 (`modeloAnalisis()`). ✓
- **§3.5 UI con patrón de streaming existente** → Task 10 (fetch+reader). ✓
- **§3.6 / §8 Testabilidad** → puros (`aDocumento`, `sanitizarConsultaFts`, `construirContextoChat`) y DB `:memory:` testeados; LLM verificado a mano. ✓
- **§7 Errores** → consulta vacía/inválida → `[]` (Task 3/5); sin clave → 503, id inexistente → 404 (Task 9); indexado best-effort (Task 4); transcripción truncada (Task 8). ✓

**Consistencia de tipos:** `DocIndice`/`ResultadoBusqueda` (indice.ts) → `ItemBiblioteca` (buscador) comparten forma (`id, titulo, plataforma, url, fechaAnalisis, snippet?`); `ResultadoBusqueda` mapea `fecha`→`fechaAnalisis` en `buscar`. `MensajeChat` (responder.ts) reutilizado por la ruta y casteado a `ModelMessage[]`. `aDocumento`, `abrirIndice`, `reindexarTodo`, `persistirAnalisis`, `construirContextoChat`, `responderChat` se nombran igual en definición y uso. `etapasReales.guardar: persistirAnalisis` respeta la firma `(a: Analisis, dir?: string) => Promise<void>`.

**Pendiente conocido (no bloquea F2):** búsqueda semántica/embeddings y patrones de nicho son F4 (sobre la misma base SQLite). `ExperimentalWarning` de `node:sqlite` es esperado.
