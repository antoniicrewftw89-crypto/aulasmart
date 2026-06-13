# AulaSmart F5 — Ingesta: material → borrador de árbol que apruebas

**Fecha:** 2026-06-13 · **Estado:** aprobado (Antonio cedió la dirección y la verificación)

## Contexto
F5 es el último paso del roadmap de AulaSmart y el de mayor valor para Antonio:
mete material (PDF de clase, transcripción de Nate en TXT, texto pegado) y la IA
propone un **árbol de estudio** que él **revisa y aprueba**. Mantiene la filosofía
de la casa: *el humano diseña/aprueba, la IA es la empleada que propone* — nunca
un árbol autogenerado que se impone (ese fue el error del viejo aulasmart-ai).

Decisiones tomadas con Antonio: (1) **entrada doble** — subir PDF/TXT **o** pegar
texto; (2) **revisión unificada** — las tres formas de aprobar (todo de golpe,
nodo a nodo, edición libre) conviven en una sola pantalla; (3) **destino doble** —
crea árbol nuevo o fusiona como rama en un tema existente.

## Flujo
**Material → IA propone árbol (todo en estado `borrador`) → revisión a tu ritmo → árbol tuyo.**

## Diseño

### 1. Entrada
Botón **📥 Ingerir** (inicio + caja de herramientas) abre el **cajón de ingesta**:
- Soltar **PDF/TXT** o **pegar texto**.
- Elegir **destino**: *árbol nuevo* o *añadir a un tema existente* (rama bajo un nodo).
- PDF → texto en el servidor con **`unpdf`** (TS, sin binarios). TXT/pegado directos.

### 2. IA (gratis-first, una llamada)
Reusa **`conRouter`** (Groq→Gemini gratis; Claude solo explícito) + **`generateObject`**
con esquema Zod **de 3 niveles fijos** (título + ramas + subpuntos + sub-subpuntos —
sin recursión `z.lazy`, mejor para salida estructurada y acota la profundidad).
Por nodo: `texto` (concepto) y `notas` opcional (1-2 frases de apoyo). **Sin fuentes
inventadas**. Documento largo → se **recorta** con aviso (troceado = futuro).

### 3. Construcción del borrador (reusa el modelo puro)
El servidor convierte el outline en Árbol con `crearArbol` + `agregarHijo` +
`editarNodo` (mismos puros → hereda auto-layout). Todos los nodos nacen en
`borrador`. Nodos con `texto` vacío se saltan (sus hijos se reenganchan al padre).
Se **guarda** (storage atómico + espejo) y se abre el editor en modo revisión.

### 4. Revisión unificada (sobre el editor existente, `?revisar=1`)
Una **barra de revisión** encima del lienzo:
- **✅ Aceptar todo** → marca todos los nodos `verificado` (el "completo y ya").
- **➡ Siguiente sin revisar** → recorre los `borrador` uno a uno, resaltando; por
  nodo ✅ aceptar · ✏️ editar · 🗑 quitar (el "nodo a nodo").
- **✋ Libre** → editar en el lienzo como siempre.
- **Hecho** → cierra la barra; lo que quede es el árbol.

Las tres son afordancias de una sola pantalla (editor + estado por nodo existente).

### 5. Destino
- *Nuevo* → `crearArbol` con slug derivado del título; abre revisión.
- *Fusionar* → `leerArbol` destino, injerta un nodo `= título` bajo el nodo elegido
  y cuelga las ramas; guarda; abre revisión ahí.

## Arquitectura / archivos
- **Nuevos:**
  - `src/lib/ingesta/esquema.ts` — Zod (3 niveles) + `construirPromptIngesta` +
    `aplicarOutline(arbol, padreId, ramas)` → Árbol (**puro, TDD**).
  - `src/lib/ingesta/texto.ts` — `extraerTextoPDF(buffer)` (unpdf) + `recortar(texto, max)`.
  - `src/app/api/ingesta/route.ts` — POST (FormData: `texto`, `archivo`, `destino`, `proveedor`).
  - `src/components/ingesta/cajon-ingesta.tsx` — el cajón de entrada.
  - `src/components/ingesta/barra-revision.tsx` — la barra de revisión.
- **Modificados:** `editor-arbol.tsx` (barra si `?revisar=1`), inicio + `caja-herramientas.tsx` (botón 📥).
- **Reutiliza:** `conRouter`, patrón `generateObject`/Zod, `crearArbol`/`agregarHijo`/`editarNodo`,
  `slug.ts`, `guardarArbol`, espejo, el editor entero y los estados por nodo.
- **Dependencia nueva:** `unpdf`.

## Fuera de alcance (MVP)
OCR de PDFs escaneados (sin capa de texto), troceado de documentos enormes
(se recorta), varios archivos a la vez, y "no guardar hasta aprobar" (en el MVP
se guarda como borrador; rechazar = a la papelera, ya reversible).

## Verificación
1. Tests puros: `aplicarOutline` (outline→árbol, nodos vacíos saltados, todo
   `borrador`) y `recortar` (corto intacto / largo recortado+flag). `pnpm test` verde.
2. `pnpm tsc --noEmit && pnpm lint && pnpm build` limpios.
3. Smoke real: ingerir una transcripción TXT de Nate → árbol borrador → revisar
   en el navegador (Antonio). Con clave: la IA estructura; sin clave: 503 accionable.
4. CI verde tras push.
