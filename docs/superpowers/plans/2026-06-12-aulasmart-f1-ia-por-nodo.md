# AulaSmart F1 — IA por nodo (Verificar / Investigar): Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, modo automático autorizado por Antonio).

**Goal:** Botones **Verificar** e **Investigar** por nodo: la IA evalúa o profundiza el punto a petición explícita del humano, adjunta su respuesta como nota con fuentes y ajusta el estado del nodo. Router gratis-first; Claude solo por elección explícita; sin claves la app sigue al 100% (los botones explican qué falta).

**Architecture:** `src/lib/ia/` con dos piezas puras testeadas (prompts/schema y aplicación del resultado al árbol) + un router de proveedores desde env. Una ruta API por acción (`/api/arboles/{materia}/{tema}/nodos/{nodoId}/{accion}`) que carga el árbol, llama `generateObject`, aplica el resultado, guarda y espeja. El panel del nodo gana los dos botones + selector de proveedor.

**Tech Stack añadido:** `ai` (Vercel AI SDK v6) · `@ai-sdk/groq` · `@ai-sdk/google` · `@ai-sdk/anthropic` · `zod`

**Decisiones (con su porqué):**
- **Endpoint anidado en el árbol** (el spec decía `/api/nodos/{id}`): los ids de nodo solo son únicos dentro de su árbol; sin materia/tema no se puede cargar el JSON. Misma intención, ruta correcta.
- **Sin esquema nuevo en el nodo:** la respuesta IA se escribe en `notas` (bloque `— IA (fecha) —`) y `fuentes[]`; `estado` pasa a `verificado`/`dudoso` según veredicto. YAGNI: nada de migraciones.
- **Gratis-first real:** orden Groq → Gemini. OpenRouter queda para después (otra dependencia, mismo patrón). Claude (`claude-opus-4-8`, override `ANTHROPIC_MODEL`) **solo** si `proveedor: "claude"` viene en el body — jamás por fallback.
- **Claves por env** (`.env.local`): `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`. Sin claves → 503 con mensaje accionable. Se documentan en `.env.example`.

---

### Task 1: Dependencias + .env.example

```bash
pnpm add ai @ai-sdk/groq @ai-sdk/google @ai-sdk/anthropic zod
```

`.env.example` (commiteable) con las tres claves comentadas y `OBSIDIAN_VAULT_PATH`/`AULASMART_DATA` opcionales. Commit: `chore(f1): AI SDK + proveedores y .env.example`.

### Task 2: `src/lib/ia/acciones-nodo.ts` (puro, TDD)

- `EsquemaRespuestaIA` (zod): `{ veredicto: "correcto"|"impreciso"|"incorrecto"|"ampliado", explicacion: string, fuentes: string[], estadoSugerido: "verificado"|"dudoso" }`.
- `construirPrompt(accion, arbol, nodo)`: system + user. Contexto: ruta raíz→nodo (`rutaDe`), hijos directos, notas propias. Verificar: "evalúa si la afirmación del estudiante es correcta". Investigar: "profundiza el punto: 3-5 ideas nuevas, ejemplos, advertencias de examen".
- `aplicarRespuesta(arbol, nodoId, r, fecha)`: añade bloque a notas (`\n\n— IA (fecha) —\n` + explicacion), une fuentes sin duplicar, estado = estadoSugerido. Devuelve árbol nuevo (usa `editarNodo`).
- Tests: prompt contiene la ruta y el texto del nodo; aplicarRespuesta escribe notas/fuentes/estado sin tocar otros nodos.

Commit: `feat(f1): prompts, esquema y aplicación de la respuesta IA (puro)`.

### Task 3: `src/lib/ia/proveedores.ts` (server)

- `proveedoresDisponibles()`: lee env, devuelve lista ordenada `[{id:"groq",...},{id:"gemini",...}]`; `claudeDisponible()`.
- `modeloPara(id)`: instancia del AI SDK (`createGroq`/`createGoogleGenerativeAI`/`createAnthropic` con su key). Modelos por defecto: `llama-3.3-70b-versatile`, `gemini-2.5-flash`, `claude-opus-4-8` (overrides `GROQ_MODEL`/`GEMINI_MODEL`/`ANTHROPIC_MODEL`).
- `generarConRouter(opciones, eleccion)`: si `eleccion==="claude"` usa Claude o falla claro; si no, recorre los gratuitos con try/catch y devuelve `{resultado, proveedor}` del primero que responda; si ninguno → error tipado `SinProveedores`.

Commit: `feat(f1): router de proveedores gratis-first (Claude solo explícito)`.

### Task 4: Ruta API `src/app/api/arboles/[materia]/[tema]/nodos/[nodoId]/[accion]/route.ts`

POST. Valida `accion ∈ {verificar, investigar}` (404 si no), carga árbol (404), encuentra nodo (404), `generateObject({ model, schema, ...prompt })` vía router (body opcional `{proveedor}`), `aplicarRespuesta`, `guardarArbol` + `espejarArbol`, responde `{nodo, proveedor, respuesta}`. Errores: 503 `SinProveedores` con mensaje "configura GROQ_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY en .env.local", 502 si todos fallan.

Smoke sin claves: `curl -X POST .../verificar` → 503 con mensaje accionable (la app no revienta).

Commit: `feat(f1): endpoint de acciones IA por nodo`.

### Task 5: UI en `panel-nodo.tsx`

- Sección "IA (tu empleada)": selector `Auto (gratis) / Claude (pago)` + botones `🔍 Verificar` y `🔬 Investigar` con estado cargando/deshabilitado; al volver, el nodo ya viene actualizado (notas/estado/fuentes) → el padre recarga el árbol vía callback `onResultadoIA(arbolActualizado?)` — más simple: el endpoint devuelve el nodo y el editor refresca con `editarNodo` aplicando los campos devueltos.
- Error → texto rojo bajo los botones (ej. el 503 accionable).
- typecheck + lint + test. Commit: `feat(f1): botones Verificar/Investigar en el panel del nodo`.

### Task 6: Verificación + docs

`pnpm test && pnpm tsc --noEmit && pnpm lint && pnpm build`. README: sección F1 con las claves y el selector. Commit final.

**Cobertura spec F1:** Verificar+Investigar por nodo ✓ · resultado como nota con fuentes y estado ✓ · router multimodelo gratis-first ✓ · Claude jamás sin elección ✓ · sin claves funciona todo ✓.
