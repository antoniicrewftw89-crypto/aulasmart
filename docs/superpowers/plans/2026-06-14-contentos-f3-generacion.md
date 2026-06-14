# ContentOS F3.1 — Hub de Generación (imágenes): Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans o subagent-driven-development. Pasos con checkboxes.

**Goal:** Desde `/biblioteca/[id]`, generar imágenes a partir de los `promptsImagen` del análisis y guardarlas localmente. **Mock-first**: todo el flujo se verifica sin claves; fal.ai (FLUX schnell) es un proveedor real drop-in cuando exista `FAL_KEY`.

**Architecture:** Generadores modulares en `src/lib/generators/` (interface `Generador`, registry gratis-first con mock siempre disponible). Assets en `data/generaciones/<analisisId>/` + sidecar `data/generaciones/<analisisId>.json` (JSON del análisis intacto). API genera/lista/sirve; UI con botón por prompt. `@fal-ai/client@1.10.1` ya instalado.

**Tech Stack:** Next 16 · node:fs/crypto · `@fal-ai/client` · vitest.

**File Structure:**
- `src/lib/generators/tipos.ts` — tipos del dominio de generación.
- `src/lib/generators/mock.ts` — generador mock (SVG, gratis, siempre disponible).
- `src/lib/generators/fal.ts` — generador fal.ai (FLUX schnell, solo si `FAL_KEY`).
- `src/lib/generators/registro.ts` — `generadoresDe`, `elegirGenerador` (puro), `seleccionarGenerador`.
- `src/lib/generators/almacen.ts` — guardar/listar generaciones + `rutaAsset`.
- `src/lib/generators/generators.test.ts` — puros + mock + almacén (dir temporal).
- `src/app/api/generar/route.ts` — POST genera.
- `src/app/api/generaciones/[analisisId]/route.ts` — GET lista.
- `src/app/api/generaciones/[analisisId]/[archivo]/route.ts` — GET sirve asset.
- `src/components/generar-imagen.tsx` (client) — botón + render.
- `src/app/biblioteca/[id]/page.tsx` (modify) — sección "Generar imágenes" + "Generaciones".

---

### Task 1: Tipos + mock + registro (puros/mock, con tests)

**Files:** crear `tipos.ts`, `mock.ts`, `fal.ts`, `registro.ts`, `generators.test.ts`.

- [ ] **Step 1:** `tipos.ts` con `TipoGeneracion`, `EntradaGeneracion`, `SalidaGeneracion` (`datos: Uint8Array; extension; mime`), `Generador`, `GeneracionGuardada` (ver spec §4.1; `SalidaGeneracion` usa siempre `datos`).
- [ ] **Step 2:** `mock.ts` — `generadorMock`: tipo "imagen", `disponible()→true`, coste "gratis", `generar` devuelve un SVG (640×640) con escena+prompt escapados, como `datos` (UTF-8), `extension:"svg"`, `mime:"image/svg+xml"`.
- [ ] **Step 3:** `fal.ts` — `generadorFal`: `disponible()⇔process.env.FAL_KEY`, coste "~$0.003"; `generar` hace `fal.config({credentials})`, `fal.subscribe("fal-ai/flux/schnell",{input:{prompt,image_size:"square_hd"}})`, descarga `data.images[0].url`, devuelve PNG.
- [ ] **Step 4:** `registro.ts` — `generadoresDe(tipo)` filtra `[generadorFal, generadorMock]` por tipo+disponible; `elegirGenerador(disp, mock, preferido?)` PURO; `seleccionarGenerador(tipo, preferido?)`.
- [ ] **Step 5:** Tests: `elegirGenerador` (preferido / primero / fallback mock), `generadorMock.generar` (SVG contiene el prompt; mime svg). Run `pnpm vitest run src/lib/generators/generators.test.ts` → PASS. Commit.

### Task 2: Almacén de generaciones (assets + sidecar)

**Files:** crear `almacen.ts`, ampliar `generators.test.ts`.

- [ ] **Step 1:** `guardarGeneracion(analisisId, salida, meta, dir?)` → escribe `data/generaciones/<id>/<genId>.<ext>` y actualiza sidecar `<id>.json` (atómico tmp+rename); devuelve `GeneracionGuardada`. `listarGeneraciones(analisisId, dir?)` → `[]` si no hay. `rutaAsset(analisisId, archivo, dir?)`.
- [ ] **Step 2:** Tests con dir temporal (`mkdtemp`): guardar→listar round-trip; dos guardados → 2 registros (no se pisan); `listarGeneraciones` de id inexistente → `[]`. Run → PASS. Commit.

### Task 3: API (generar / listar / servir)

**Files:** crear las 3 rutas.

- [ ] **Step 1:** `POST /api/generar` — valida (`tipo==="imagen"`, prompt, analisisId), 404 si no existe, `seleccionarGenerador`, genera, guarda, 502 si el proveedor falla. Devuelve `GeneracionGuardada`.
- [ ] **Step 2:** `GET /api/generaciones/[analisisId]` → `listarGeneraciones`.
- [ ] **Step 3:** `GET /api/generaciones/[analisisId]/[archivo]` → sirve el asset con su mime; rechaza path traversal (`/`, `\`, `..`) → 400; 404 si falta. Commit (typecheck).

### Task 4: UI en el detalle

**Files:** crear `generar-imagen.tsx`, modificar `biblioteca/[id]/page.tsx`.

- [ ] **Step 1:** `GenerarImagen` (client): props `analisisId, prompt, escena?, generador, coste`; botón "Generar imagen ({generador} · {coste})"; al pulsar `POST /api/generar`, spinner, muestra `<img src="/api/generaciones/<id>/<archivo>">`; error inline.
- [ ] **Step 2:** En el detalle (server), calcular `gen = seleccionarGenerador("imagen")` y, bajo VistaAnalisis, una sección "Generar imágenes" que mapea `a.analisis.promptsImagen` a filas (escena + prompt + `<GenerarImagen ... generador={gen.nombre} coste={gen.costeEstimado}>`). Sección "Generaciones" que lista las guardadas (fetch a la API o `listarGeneraciones` en server). typecheck+lint+build. Commit.

### Task 5: Verificación (mock E2E) + memoria

- [ ] **Step 1:** `pnpm test && typecheck && lint && build` verde.
- [ ] **Step 2:** E2E mock (`pnpm start`): `POST /api/generar` con un analisisId real y un prompt → devuelve registro; `GET` del asset → SVG; aparece en `GET /api/generaciones/[id]`.
- [ ] **Step 3:** Actualizar memoria con estado F3.1. Commit. Merge a `main`.

---

## Self-Review (cobertura del spec F3)
- §3.1 mock-first/modular → Task 1 (registry + mock siempre disponible). ✓
- §3.2 sidecar, JSON intacto → Task 2. ✓
- §3.3 servir assets → Task 3 step 3. ✓
- §3.4 fal.ai drop-in → Task 1 step 3 (sin verificación hasta `FAL_KEY`). ✓
- §3.5 gate de coste → Task 4 (botón muestra generador+coste; clic explícito). ✓
- §6 errores → 400/404/502, path traversal, atómico. ✓
- §7 testing → puros+mock+almacén; fal a mano. ✓
**Tipos:** `Generador`, `SalidaGeneracion(datos)`, `GeneracionGuardada` definidos en Task 1 y reutilizados en almacén/API/UI.
