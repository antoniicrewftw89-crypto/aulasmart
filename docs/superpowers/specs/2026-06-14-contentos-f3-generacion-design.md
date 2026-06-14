# ContentOS F3 — Hub de Generación (incremento 1: imágenes): Spec de Diseño

**Fecha:** 2026-06-14
**Estado:** Aprobado (decisiones autónomas en automode; ver §0)
**Repo de código:** `C:\Workspace\contentos`
**Spec/planes viven en:** `C:\Workspace\aulasmart\docs\superpowers\`
**Autor:** Antonio Pérez + Claude Opus

---

## 0. Contexto

F1 (análisis) y F2 (biblioteca+búsqueda+chat) están **completas y mergeadas a `main`**. El análisis ya produce `promptsImagen[]` y `promptsVideo[]` (cada uno: `escena`, `prompt`, `herramientaSugerida`). F3 cierra el lazo del lema "el video es el kernel": desde un análisis guardado, **generar assets reales** a partir de esos prompts.

**Bloqueo conocido:** la generación real cuesta dinero y necesita claves que **no están en `.env.local`** (fal.ai/Higgsfield/ElevenLabs/Ideogram). Antonio se ausenta. Por eso este spec se diseña **mock-first**: toda la fontanería del hub (UI → API → generar → guardar → mostrar) se construye y **verifica con un generador mock gratuito**, y los proveedores reales son módulos **drop-in** que se activan cuando exista su clave. Así F3 avanza de forma verificable hoy y queda lista para enchufar fal.ai en cuanto Antonio ponga `FAL_KEY`.

**Alcance de ESTE incremento (F3.1):** generación de **imágenes**. Video (Higgsfield), audio/voz (ElevenLabs) e imágenes-con-texto (Ideogram) son incrementos posteriores sobre **la misma arquitectura**.

---

## 1. Objetivo

Desde `/biblioteca/[id]`, junto a cada `promptImagen`, un botón **"Generar"** produce una imagen (mock por defecto; fal.ai/FLUX si hay clave), la guarda localmente y la muestra inline. Una sección "Generaciones" lista lo creado para ese análisis.

**Criterios de éxito (verificables sin claves):**
- Con cero claves, pulsar "Generar" en un prompt crea una imagen **placeholder** (mock), la guarda en `data/generaciones/…` y la muestra. La app nunca falla por falta de proveedores.
- El registro de generación se persiste y reaparece al recargar.
- Cuando exista `FAL_KEY`, el mismo botón usa **fal.ai (FLUX schnell)** sin cambiar nada del flujo.
- Lógica pura (selección de generador, coste, registro) testeada; flujo mock testeado E2E; `pnpm test/typecheck/lint/build` verde.

---

## 2. Alcance

### Dentro (F3.1)
- Interfaz `Generador` + registry gratis-first (mock siempre disponible).
- Generador **mock** (placeholder SVG, gratis, determinista) — el que hace todo verificable.
- Generador **fal.ai** imágenes (`@fal-ai/client`, `fal-ai/flux/schnell`), activo solo con `FAL_KEY`.
- Storage de generaciones (assets en disco + sidecar JSON por análisis).
- API `POST /api/generar` + `GET /api/generaciones/[id]`.
- UI: botón "Generar" por `promptImagen` en el detalle + sección "Generaciones".
- Gate de coste: acción explícita del usuario, muestra proveedor y coste estimado; nunca auto-genera.

### Fuera (incrementos/fases posteriores)
- **Video** (Higgsfield/Luma), **audio/voz** (ElevenLabs), **imágenes-con-texto** (Ideogram), **avatares** (HeyGen) → F3.2+ sobre esta misma arquitectura.
- Reintentos/colas para generación masiva → F4.
- Edición/variaciones/upscaling de imágenes → posterior.

---

## 3. Decisiones de arquitectura (con su porqué)

### 3.1 Mock-first y modular (la app funciona sin ninguna clave)
Replica el patrón gratis-first de `proveedor.ts`. Cada generador es un módulo aislado en `src/lib/generators/`. El **mock está siempre disponible** y es el generador por defecto cuando no hay proveedores reales. Esto cumple el principio del spec maestro (§7: "la app funciona aunque no esté configurada ninguna") y, sobre todo, hace **todo el flujo verificable y demostrable sin gastar dinero**.

### 3.2 JSON canónico intacto; generaciones en sidecar
Para no mutar el `data/<id>.json` del análisis en cada generación (riesgo de corrupción/peso), las generaciones se guardan **aparte**:
- Assets binarios → `data/generaciones/<analisisId>/<genId>.<ext>`.
- Metadatos → `data/generaciones/<analisisId>.json` (lista de `GeneracionGuardada`, escritura atómica tmp+rename como en F1).
El análisis original no se toca. (Corresponde al campo `generaciones[]` del modelo del spec maestro §11, aquí desacoplado en sidecar.)

### 3.3 Servir los assets
Las imágenes viven bajo `data/` (gitignored, fuera de `public/`). Una ruta `GET /api/generaciones/<analisisId>/<archivo>` sirve el binario con su content-type. Así no hay que copiar a `public/` ni exponer el FS. (El mock puede devolver un data-URI inline, sin archivo; fal.ai devuelve una URL remota que descargamos y guardamos local para no depender de su CDN.)

### 3.4 fal.ai como proveedor real (primer drop-in)
`@fal-ai/client`: `fal.config({ credentials: process.env.FAL_KEY })` y `fal.subscribe("fal-ai/flux/schnell", { input: { prompt, image_size } })` → `result.data.images[0].url`. FLUX **schnell** por ser el más barato/rápido (~$0.003/MP). Se descarga la URL resultante y se guarda local. El módulo solo se carga/usa si `FAL_KEY` existe.

### 3.5 Gate de coste explícito
Cada `Generador` declara `costeEstimado` (texto legible, p.ej. "gratis" o "~$0.003"). La UI muestra proveedor+coste en el botón; generar es **siempre** acción explícita del usuario (un clic por prompt). Nunca se genera en bloque ni automáticamente. El mock es "gratis".

### 3.6 Aislamiento/testabilidad
- `seleccionarGenerador(tipo, generadores, preferido?)` — puro, testeable (elige real configurado > mock).
- `crearRegistroGeneracion(...)` — puro, construye `GeneracionGuardada`.
- Generador **mock** — determinista, sin red: test directo.
- Storage de generaciones — round-trip con dir temporal.
- Generador **fal.ai** — no se testea en unitario (necesita clave/red); se valida a mano cuando exista `FAL_KEY`.

---

## 4. Componentes y contratos

### 4.1 `src/lib/generators/tipos.ts`
```ts
export type TipoGeneracion = "imagen" | "video" | "audio";

export interface EntradaGeneracion {
  prompt: string;
  escena?: string;
}

export interface SalidaGeneracion {
  // uno de los dos: data-URI inline (mock) o buffer + extensión (real)
  dataUri?: string;
  datos?: Uint8Array;
  extension: string;       // "svg" | "png" | "jpg" …
  mime: string;
}

export interface Generador {
  id: string;              // "mock" | "fal" …
  nombre: string;          // legible
  tipo: TipoGeneracion;
  costeEstimado: string;   // "gratis" | "~$0.003"
  disponible(): boolean;   // según env
  generar(e: EntradaGeneracion): Promise<SalidaGeneracion>;
}

export interface GeneracionGuardada {
  id: string;              // genId
  analisisId: string;
  tipo: TipoGeneracion;
  generador: string;       // id del generador usado
  prompt: string;
  escena?: string;
  archivo: string;         // nombre relativo en data/generaciones/<analisisId>/
  fecha: string;           // ISO
}
```

### 4.2 `src/lib/generators/mock.ts`
Generador `mock` (tipo "imagen", siempre `disponible() === true`, coste "gratis"). Devuelve un **SVG** determinista que pinta la escena/prompt (texto recortado) sobre un fondo → `dataUri` o `datos` (SVG es texto). Sirve para verificar todo el flujo sin red.

### 4.3 `src/lib/generators/fal.ts`
Generador `fal` (tipo "imagen", `disponible()` ⇔ `process.env.FAL_KEY`, coste "~$0.003"). Usa `@fal-ai/client` + `fal-ai/flux/schnell`; descarga `result.data.images[0].url` → `datos` (PNG). Import del paquete perezoso para no romper si no está instalado/configurado.

### 4.4 `src/lib/generators/registro.ts`
```ts
export function generadoresDe(tipo: TipoGeneracion): Generador[]; // disponibles, reales primero, mock al final
export function seleccionarGenerador(tipo: TipoGeneracion, preferido?: string): Generador; // puro sobre la lista
```

### 4.5 `src/lib/generators/almacen.ts`
`guardarGeneracion(analisisId, salida, meta) → GeneracionGuardada` (escribe asset + actualiza sidecar atómico) · `listarGeneraciones(analisisId) → GeneracionGuardada[]` · `rutaAsset(analisisId, archivo)`.

### 4.6 API
- `POST /api/generar` — body `{ analisisId, tipo, prompt, escena?, generador? }`. Valida análisis existe (404), elige generador, genera, guarda, devuelve `GeneracionGuardada`. Errores de proveedor → 502 con mensaje (no rompe la app). `runtime="nodejs"`.
- `GET /api/generaciones/[analisisId]` — lista las generaciones del análisis.
- `GET /api/generaciones/[analisisId]/[archivo]` — sirve el binario del asset con su mime.

### 4.7 UI
- `src/components/generar-imagen.tsx` (client): botón "Generar imagen ({generador} · {coste})" junto a cada `promptImagen`; al pulsar, `POST /api/generar`, muestra spinner y luego la imagen.
- `src/components/generaciones-analisis.tsx` (client/server): sección que lista las generaciones guardadas (carga `GET`).
- Montaje en `/biblioteca/[id]`: botón por cada prompt de imagen + sección "Generaciones".

---

## 5. Flujo de datos

```
Usuario pulsa "Generar" en un promptImagen (detalle /biblioteca/[id])
  → POST /api/generar { analisisId, tipo:"imagen", prompt, escena }
  → seleccionarGenerador("imagen")  (fal si FAL_KEY, si no mock)
  → generador.generar({prompt,escena}) → SalidaGeneracion (svg mock / png fal)
  → almacen.guardarGeneracion → escribe data/generaciones/<id>/<genId>.<ext>
                                + actualiza sidecar data/generaciones/<id>.json
  → devuelve GeneracionGuardada
  → UI muestra <img src="/api/generaciones/<id>/<archivo>">
```

---

## 6. Manejo de errores

| Caso | Estrategia |
|---|---|
| Sin claves reales | `seleccionarGenerador` cae al **mock**; la app genera placeholders, nunca falla. |
| Proveedor real falla (red/clave inválida) | 502 con mensaje; el análisis y lo demás siguen intactos (error no-fatal). |
| `@fal-ai/client` no instalado | `fal.disponible()` también comprueba import; si falla, no se ofrece. |
| analisisId inexistente | 404. |
| Asset inexistente al servir | 404. |
| Escritura de asset/sidecar | atómica (tmp+rename); si falla, 500 con mensaje, sin corromper el sidecar. |

---

## 7. Estrategia de testing

- **Puro:** `seleccionarGenerador` (real>mock; preferido; sin disponibles→mock), `crearRegistroGeneracion`.
- **Mock:** `generar` devuelve SVG con el prompt; determinista.
- **Almacén (dir temporal):** guardar→listar round-trip; sidecar no duplica; atómico.
- **Real (fal):** NO en unitario. Verificación manual con `FAL_KEY` (cuando exista).
- **Gate:** `pnpm test && typecheck && lint && build` verde. Flujo mock demostrable en navegador sin claves.

---

## 8. Principios (de F1/F2)
Lógica pura testeada · todo por `/api/*` · gratis-first (mock como base; fal.ai opcional) · modular (cada generador aislado y opcional) · local-first (assets+sidecar en `data/`) · extensible (nuevos generadores = nuevo módulo; video/audio/Ideogram reutilizan esta base).

---

## 9. Orden de construcción (el plan lo detalla)
1. Tipos + mock + registro + selección (puros/mock, tests).
2. Almacén de generaciones (assets + sidecar, tests dir temporal).
3. API generar + listar + servir asset.
4. UI: botón generar + sección generaciones en el detalle.
5. Generador fal.ai (drop-in, sin verificación hasta que haya `FAL_KEY`).
6. Verificación (mock E2E) + memoria.
```
