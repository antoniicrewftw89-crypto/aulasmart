# ContentOS F2 — Biblioteca navegable, Búsqueda y Chat: Spec de Diseño

**Fecha:** 2026-06-14
**Estado:** Aprobado (decisiones tomadas en automode por Claude; ver §0)
**Repo de código:** `C:\Workspace\contentos` (independiente)
**Spec/planes viven en:** `C:\Workspace\aulasmart\docs\superpowers\` (convención del proyecto)
**Autor:** Antonio Pérez + Claude Opus

---

## 0. Contexto de esta sesión

Antonio arrancó la Fase 2 y se ausenta ~5h pidiendo trabajo continuo en automode, **sin gates interactivos**. Por eso este spec toma las decisiones de diseño de forma autónoma, fundamentándolas, en lugar de preguntar una a una. Mantiene lo esencial del flujo `brainstorming → spec → plan → implementación` de F1: diseño escrito **antes** de tocar código.

**Elección Fase 2 vs Fase 3:** se eligió **Fase 2** porque (a) es el orden canónico del spec maestro (§13: F2 = Biblioteca y Chat), (b) es *gratis-first y verificable offline* (chat con Gemini gratis, SQLite local, todo cubrible con vitest), y (c) Fase 3 dependería de claves de generación que **no están en `.env.local`** (Higgsfield/fal.ai/ElevenLabs/Ideogram) y cuesta dinero por generación → no verificable E2E en ausencia de Antonio.

---

## 1. Objetivo

Tras F1, ContentOS analiza un video y guarda un JSON. Pero esos análisis están **muertos**: la biblioteca los lista pero no se puede entrar a ninguno, no hay búsqueda y no se puede "hablar" con un video ya analizado.

F2 convierte la biblioteca en algo **vivo y navegable**:

1. **Biblioteca navegable** — clicar un análisis abre una vista de detalle con los 15 análisis + transcripción bien renderizados.
2. **Búsqueda** — un buscador encuentra análisis por título, autor, resumen, transcripción, keywords y hashtags, con SQLite + FTS5.
3. **Chat con el video** — preguntar en lenguaje natural sobre un análisis guardado; el modelo (Gemini gratis) responde usando el análisis + transcripción como contexto, **sin reprocesar el video**.

**Criterios de éxito:**
- Desde `/biblioteca` puedo buscar "pricing" y ver solo los análisis que lo mencionan.
- Clico un resultado y veo el análisis completo + transcripción, legible (no JSON crudo).
- En esa misma página pregunto "¿en qué minuto habla de X?" y obtengo respuesta en streaming, fundamentada en el contenido guardado.
- Todo el dominio nuevo (índice, contexto de chat) tiene tests; `pnpm test/typecheck/lint/build` en verde.

---

## 2. Alcance

### Dentro (F2)
- Índice SQLite derivado de los JSON, con FTS5 para búsqueda full-text.
- API de búsqueda/listado: `GET /api/biblioteca?q=...`.
- Página de detalle navegable `/biblioteca/[id]`.
- Renderizado legible de los 15 análisis estructurados (no `JSON.stringify`).
- Chat con el video: contexto + endpoint + UI con streaming.
- Auto-reparación del índice (reindexar desde los JSON si está vacío/ausente).

### Fuera (otras fases, YAGNI ahora)
- **Búsqueda semántica / embeddings / vectores** → F4 (inteligencia). F2 hace full-text por palabras clave, que es lo que aporta valor a esta escala (un usuario, decenas-cientos de análisis).
- **Patrones de nicho, perfil de estilo, comparativo multi-video, bulk, calendario** → F4.
- **Hub de generación** (Higgsfield/fal.ai/ElevenLabs/Ideogram) → F3.
- **Borrar análisis** desde la biblioteca → no pedido; se omite (se puede borrar el JSON a mano). Reevaluable.
- **Auth / multiusuario** → F5.

---

## 3. Decisiones de arquitectura (con su porqué)

### 3.1 SQLite vía `node:sqlite` integrado + FTS5
Node del proyecto es **v25.8.1**. Esto descarta `better-sqlite3` (módulo nativo; en Node 25, recién salido, probablemente sin binario precompilado → compilaría desde fuente con MSVC → alto riesgo de fallo en automode). En su lugar se usa **`node:sqlite`** (`DatabaseSync`), módulo **integrado** en Node: cero dependencias, cero compilación, cero riesgo de bundling con Next/Turbopack (es un builtin `node:`). Se verificó en vivo que `DatabaseSync`, las consultas `LIKE` y **`CREATE VIRTUAL TABLE ... USING fts5`** funcionan en este Node.

> `node:sqlite` está marcado *experimental* y emite un `ExperimentalWarning`. Aceptable para una app local de un solo usuario. Se silencia el warning concreto en el punto de entrada del módulo si molesta en consola.

### 3.2 JSON canónico, SQLite derivado
Los `data/<id>.json` siguen siendo la **fuente de verdad** (local-first, git-friendly, ya establecido en F1). El SQLite (`data/contentos.db`, gitignored bajo `/data`) es un **índice derivado y reconstruible**: si se corrompe o se borra, `reindexarTodo()` lo regenera desde los JSON. Así el índice nunca es un punto único de fallo de los datos.

### 3.3 Indexado en escritura + auto-reparación en lectura
- **En escritura:** al guardar un análisis nuevo (pipeline F1), además del JSON se indexa en SQLite (best-effort: si el indexado falla, el análisis se guarda igual y se loguea; nunca rompe el pipeline). Se implementa componiendo una etapa `persistir = guardarAnalisis + indexarAnalisis` y cableándola como el `guardar` real del orquestador — **sin tocar el test del orquestador**, que inyecta su propio `guardar`.
- **En lectura:** si la API de biblioteca detecta el índice vacío pero hay JSON en disco (caso de los 2 análisis de F1), dispara `reindexarTodo()` una vez. Self-healing.

### 3.4 Chat reutiliza el router de proveedor (gratis-first)
El chat usa `modeloAnalisis()` de `src/lib/analisis/proveedor.ts` tal cual: **Gemini 2.5 Flash gratis** por defecto, Claude si se configura. Cero infra nueva de modelos. El chat es texto (no objeto estructurado) → se usa `streamText` de AI SDK v6 (la versión exacta de la API se confirma contra los docs de `ai@^6` y `node_modules/next/dist/docs/` al implementar, por el aviso de Next 16 en `AGENTS.md`).

### 3.5 UI de chat con el patrón de streaming ya existente
No se añade `@ai-sdk/react`/`useChat` (no instalado, API en evolución). El componente de chat replica el **patrón manual `fetch` + lector de stream** que ya usa `formulario-analisis.tsx`. Coherencia con el código existente y control total del render incremental.

### 3.6 Aislamiento y testabilidad
Cada pieza nueva tiene una frontera clara y las partes puras se testean sin red ni disco:
- `aDocumento(analisis)` — proyección pura `Analisis → documento indexable`.
- `sanitizarConsultaFts(q)` — pura: convierte texto de usuario en una consulta `MATCH` de FTS5 segura.
- `construirContextoChat(analisis, opts?)` — pura: arma el contexto del modelo.
- Operaciones de DB → tests con base `:memory:` (síncrona, sin disco).
- Llamadas al LLM → **no** en tests unitarios (verificación manual por Antonio, como en F1 Task 14).

---

## 4. Componentes y contratos

### 4.1 `src/lib/storage/indice.ts` — índice de búsqueda

```ts
export interface DocIndice {
  id: string;
  url: string;
  titulo: string;
  autor: string;
  plataforma: string;
  fecha: string;        // ISO (fechaAnalisis)
  resumen: string;
  transcript: string;   // texto completo
  keywords: string;     // keywords unidas por espacio
  hashtags: string;     // hashtags unidos por espacio
}

/** Proyección pura Analisis -> documento indexable. */
export function aDocumento(a: Analisis): DocIndice;

/** Convierte input libre del usuario en una consulta MATCH de FTS5 segura
 *  (escapa comillas, tokeniza, añade prefijo * para match parcial). "" si vacío. */
export function sanitizarConsultaFts(q: string): string;

/** Abre/crea la DB y garantiza el esquema FTS5. Reutilizable (singleton por ruta). */
export function abrirIndice(rutaDb?: string): IndiceDB;

// Métodos sobre IndiceDB (envuelven node:sqlite):
//   indexar(doc: DocIndice): void           // upsert por id
//   buscar(q: string, limite?): ResultadoBusqueda[]   // [] si q vacío
//   reindexarTodo(dirDatos?): number        // limpia y reconstruye desde los JSON; devuelve nº indexados
//   contar(): number
//   cerrar(): void
```

**Esquema FTS5** (tabla virtual `analisis_fts`):
- Columnas indexadas: `titulo, autor, resumen, transcript, keywords, hashtags`.
- Columnas `UNINDEXED` (para devolver el resumen del resultado sin releer JSON): `id, url, plataforma, fecha`.
- Tokenizer: `unicode61 remove_diacritics 2` (búsqueda insensible a acentos y mayúsculas — clave en español).
- `buscar` ordena por relevancia `bm25(analisis_fts)`.

`ResultadoBusqueda` reutiliza la forma de `ResumenAnalisis` de F1 (`id, titulo, plataforma, url, fechaAnalisis`) + opcional `snippet` (FTS5 `snippet()`), para que la UI de biblioteca renderice resultados y listado con el mismo componente.

### 4.2 `src/lib/storage/persistir.ts` — escritura + indexado
Archivo dedicado (no se mete en `disco.ts` para que `disco.ts` siga siendo JSON puro sin depender del índice). `persistirAnalisis(a)` = `guardarAnalisis(a)` (JSON atómico, F1) y luego `abrirIndice().indexar(aDocumento(a))` en try/catch best-effort. Es la etapa `guardar` real del orquestador (`etapasReales.guardar`).

### 4.3 `src/lib/chat/contexto.ts` — contexto del chat (puro)
```ts
export function construirContextoChat(a: Analisis, opts?: { maxTranscript?: number }): string;
```
Compone un *system prompt* con: título/autor/plataforma/duración, resumen, estructura (timestamps), hooks, estrategia, audiencia, y la transcripción (truncada a `maxTranscript`, por defecto ~8000 caracteres, indicando "[...]" si se truncó). Instruye al modelo a responder **solo** con base en este contexto, en español, citando timestamps cuando aplique, y a decir "no aparece en el video" si la respuesta no está en el contenido.

### 4.4 `src/lib/chat/responder.ts` — respuesta en streaming
```ts
export interface MensajeChat { role: "user" | "assistant"; content: string; }
export function responderChat(a: Analisis, mensajes: MensajeChat[]): /* stream de texto AI SDK v6 */;
```
Usa `streamText({ model: modeloAnalisis().modelo, system: construirContextoChat(a), messages })`. Devuelve el resultado de `streamText` para que la ruta lo convierta en respuesta HTTP streameada.

### 4.5 API
- `GET /api/biblioteca?q=<texto>` — sin `q` → `listarAnalisis()` (F1, desde JSON). Con `q` → `abrirIndice().buscar(q)`; si el índice está vacío y hay JSON, `reindexarTodo()` primero. Devuelve `ResumenAnalisis[]` (+ snippet en búsqueda).
- `POST /api/chat` — body `{ id: string, mensajes: MensajeChat[] }`. Carga `leerAnalisis(id)` (404 si no existe), valida que haya clave de proveedor (503 con mensaje accionable si no), y devuelve el stream de `responderChat`. `runtime = "nodejs"`.
- `GET /api/analisis/[id]` — ya existe (F1), se reutiliza para la página de detalle si se hidrata en cliente; la página de detalle es server component y puede usar `leerAnalisis` directo.

### 4.6 Páginas y componentes
- `/biblioteca/page.tsx` — añade `<BuscadorBiblioteca>` (client) arriba; cada item enlaza a `/biblioteca/[id]`. El listado inicial sigue siendo server-rendered (`listarAnalisis`); el buscador, al teclear, llama a `/api/biblioteca?q=` y reemplaza la lista.
- `/biblioteca/[id]/page.tsx` — server component: `leerAnalisis(id)` (404 → `notFound()`); renderiza metadata + `<VistaAnalisis>` (los 15 análisis legibles) + `<TranscriptView>` + `<ChatVideo id={id}>`.
- `src/components/vista-analisis.tsx` — renderiza el `AnalisisIA` completo con formato por sección (hooks como lista con timestamp, estructura como línea temporal, seo como chips, arrays como listas). Se factoriza un renderer por tipo de sección reutilizable también por `resultado-analisis.tsx` (streaming) para no duplicar lógica.
- `src/components/buscador-biblioteca.tsx` — input con debounce que consulta la API y pinta resultados (resumen + snippet).
- `src/components/chat-video.tsx` — client: historial de mensajes + input; al enviar, `fetch` a `/api/chat` y lee el stream, anexando al mensaje del asistente (patrón de `formulario-analisis.tsx`).

---

## 5. Flujos de datos

**Búsqueda:**
```
Usuario teclea en BuscadorBiblioteca
  → GET /api/biblioteca?q=pricing
  → abrirIndice().buscar(sanitizarConsultaFts("pricing"))
     (si índice vacío y hay JSON → reindexarTodo() una vez)
  → FTS5 MATCH + bm25 → [ResumenAnalisis + snippet]
  → UI reemplaza la lista por los resultados
```

**Chat:**
```
Usuario pregunta en ChatVideo (página /biblioteca/[id])
  → POST /api/chat { id, mensajes }
  → leerAnalisis(id) → construirContextoChat(a) (system)
  → streamText(modeloAnalisis() = Gemini gratis, system, messages)
  → stream de texto → UI anexa tokens al mensaje del asistente
```

**Indexado de un análisis nuevo (pipeline F1, sin cambios visibles):**
```
orquestador … → etapa "guardar" = persistirAnalisis(a)
  → guardarAnalisis(a)  (JSON atómico, fuente de verdad)
  → indexar(aDocumento(a))  (best-effort; error no-fatal)
```

---

## 6. Modelo de datos del índice

El índice **no** introduce un modelo nuevo de dominio: deriva de `Analisis` (F1) vía `aDocumento`. La única "tabla" es `analisis_fts` (FTS5) descrita en §4.1. La fuente de verdad sigue siendo `data/<id>.json`. Migración de los datos de F1: cubierta por `reindexarTodo()` (self-heal en primera búsqueda o vía `scripts/reindexar.ts`).

---

## 7. Manejo de errores

| Caso | Estrategia |
|---|---|
| Indexado falla al guardar | Best-effort: el JSON se guarda igual; se loguea; búsqueda lo recupera tras un reindex. |
| Índice ausente/vacío con JSON presentes | `reindexarTodo()` automático en la primera lectura de búsqueda. |
| DB corrupta | Borrar `data/contentos.db` y reindexar (documentado); `scripts/reindexar.ts`. |
| `q` vacío o solo símbolos | `sanitizarConsultaFts` devuelve "" → la API responde el listado normal (no error). |
| Consulta FTS5 inválida (sintaxis MATCH) | Saneada antes de ejecutar; si aun así lanza, se captura y se devuelve `[]` con 200. |
| `/api/chat` sin clave de proveedor | 503 con mensaje accionable (mismo criterio que F1 para `/api/analizar`). |
| `/api/chat` id inexistente | 404 `{ error: "No encontrado" }`. |
| Transcripción enorme | Truncada en `construirContextoChat` (límite configurable) para no exceder contexto. |

---

## 8. Estrategia de testing

- **Puro (vitest):** `aDocumento` (mapeo + unión de keywords/hashtags), `sanitizarConsultaFts` (vacío, símbolos, acentos, prefijo `*`), `construirContextoChat` (incluye campos clave; respeta truncado).
- **SQLite (`:memory:`):** round-trip `indexar` → `buscar` (encuentra por título/transcript/keyword; insensible a acentos), `reindexarTodo` (reconstruye desde un dir temporal de JSON), upsert (reindexar el mismo id no duplica).
- **Rutas/LLM:** las llamadas al modelo **no** se testean en unitario (igual que F1). La verificación E2E del chat y la búsqueda en navegador la hace Antonio (sección de verificación del plan), con la clave Gemini gratis ya presente en `.env.local`.
- **Gate global:** `pnpm test && pnpm typecheck && pnpm lint && pnpm build` en verde.

---

## 9. Principios respetados (de F1 §15)
1. Lógica pura siempre con tests (índice, contexto). 2. Todo pasa por `/api/*` (búsqueda, chat). 3. Gratis-first (chat con Gemini; SQLite local sin coste). 4. Modular (índice y chat son módulos aislados; la app sigue funcionando aunque el índice falle). 5. Local-first (JSON canónico + SQLite local). 6. Extensible (búsqueda semántica y patrones se añaden en F4 sobre la misma base SQLite).

---

## 10. Orden de construcción (resumen; el plan lo detalla por tareas TDD)
1. Índice SQLite (`indice.ts`) — puros + `:memory:` + wiring de `persistir`.
2. Búsqueda y biblioteca navegable — API `?q=`, página detalle, renderer legible, buscador.
3. Chat — contexto + responder + `/api/chat` + `ChatVideo`.
4. Verificación final + memoria.
```
