<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AulaSmart — reglas del proyecto

Comunicación y comentarios de código **en español**.

## Las 4 reglas de oro (del spec aprobado — no negociables)

1. **El humano diseña, la IA ejecuta.** La IA JAMÁS crea/edita nodos del árbol
   por su cuenta; solo actúa cuando el usuario pulsa un botón (verificar,
   investigar, generar). No reintroducir el patrón del proyecto viejo
   (`aulasmart-ai`: canvas autogenerado) — fue la razón de la refundación.
2. **Todo lo que hace la UI pasa por `/api/*`** (puertas traseras para Janus).
   Nada de lógica de dominio en componentes.
3. **Local-first y sin claves funciona el 100%.** La IA es capa opcional.
   Persistencia: un JSON por árbol en `data/` (repo git propio, escrituras
   atómicas tmp+rename, borrado = `.papelera/`). Espejo md en la bóveda
   Obsidian (`05_Estudio/`), unidireccional, fuente de verdad = JSON.
4. **Gratis-first:** router Groq → Gemini. Claude (pago) SOLO si el usuario lo
   elige explícitamente; jamás por fallback.

## Estructura

- `src/lib/arbol/` — dominio puro (tipos, modelo, slug, proyección a React Flow)
- `src/lib/storage/` — disco (solo servidor) · `src/lib/espejo/` — bóveda Obsidian
- `src/lib/ia/` — prompts/esquemas puros + router de proveedores
- `src/lib/generadores/` — árbol → artefactos (guion; F3 quiz, F4 slides)
- `src/components/editor/` — canvas React Flow + panel + barra

Lógica pura SIEMPRE con tests vitest (`pnpm test`). Antes de dar algo por
hecho: `pnpm test && pnpm tsc --noEmit && pnpm lint`. UI: Antonio la prueba
en su navegador y reporta (no usar navegador automatizado).

## Documentos fuente

- Spec: `docs/superpowers/specs/2026-06-12-aulasmart-refundacion-design.md`
- Planes por fase: `docs/superpowers/plans/`
- Roadmap y estado: README (F0 ✅ · F1 ✅ · F2 ✅ · F3 quiz/Leitner · F4 slides · F5 ingesta PDF)
