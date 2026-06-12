# AulaSmart (refundación) — Diseño

- **Fecha:** 2026-06-12
- **Estado:** aprobado por Antonio en sesión (diseño conversado sección por sección)
- **Reemplaza a:** `C:\Workspace\aulasmart-ai` (se conserva intacto hasta que este proyecto cubra lo básico; entonces se borra la carpeta local y se archiva su repo de GitHub)

## Por qué se refunda

El aulasmart-ai original se desvió de la visión. Antonio entregó como referencia las
transcripciones del sistema de IA de Nate Gentile (análisis destilado en
`synapse-vault/01_Cerebro_Estrategico/2026-06-12_analisis-sistema-ia-nate-gentile.md`),
donde el mindmap es **del humano** y la IA trabaja para él. Lo construido fue lo
contrario: un canvas autogenerado por IA desde keywords de voz, efímero por sesión,
con RAG en memoria. La relación humano-IA quedó invertida y nada persistía como
conocimiento propio.

## Visión

**Mindmap-first.** Antonio construye su árbol de ideas de estudio; la IA es la
empleada: verifica nodos, investiga puntos y genera artefactos **desde** el árbol
(guion de estudio, quiz/flashcards, slides). La experiencia de canvas tiene el listón
de Miro. Todo persiste en disco y crece con años de estudio. Toda acción se expone
por API para que un orquestador futuro (Janus propio) pueda operar la app. Todo lo
producido queda además espejado en la bóveda Obsidian (`synapse-vault`).

## Principios (de las transcripciones de Nate — no negociables)

1. **El humano diseña, la IA ejecuta.** La IA jamás escribe el árbol por su cuenta;
   propone solo cuando se le pide, y Antonio aprueba.
2. **APIs como puertas traseras.** La UI es un cliente más de la API.
3. **Clon digital.** Todo lo estudiado queda digitalizado y persistido.
4. **Gratis-first.** Los proveedores gratuitos por defecto; Claude (pago) solo por
   elección explícita, nunca por fallback.

## Identidad

- **Carpeta:** `C:\Workspace\aulasmart` · **Repo GitHub:** `aulasmart` (nuevo)
- **Puerto dev:** `3002` fijo en el script `dev` (3000 lo ocupa el viejo, 3001
  troquero, 5173 rubik-solver). Opcional: heredar el 3000 al retirar el viejo.
- **Stack:** Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + pnpm +
  `@xyflow/react` (+ dagre para auto-layout) + Vercel AI SDK.
- Mismo aviso que troquero/aulasmart-ai: Next.js 16 tiene breaking changes vs el
  conocimiento de entrenamiento → consultar `node_modules/next/dist/docs/` antes de
  escribir código.

## Modelo de datos y persistencia

- **Un árbol = un archivo JSON:** `data/arboles/{materia}/{tema}.json`.
- **Nodo:** `id`, `texto`, `notas`, `fuentes[]`, `estado` (`borrador | verificado |
  dudoso`), `color`, `etiquetas[]`, `posicion` (solo si fue movida a mano).
- **Aristas:** jerárquicas (árbol) + relaciones cruzadas opcionales con etiqueta.
- **Artefactos junto a su árbol:** `{tema}.guion.md`, `{tema}.quiz.json`,
  `{tema}.slides.json`.
- **`data/` es un repo git propio** → versionado de árboles gratis (las "versiones"
  del mindmap de Nate, sin escribir una línea).
- **Escrituras atómicas** (tmp + rename): un crash jamás corrompe un árbol.
  Autosave con debounce + indicador "guardado ✓" en la UI.
- **El storage es un módulo aislado** con interfaz propia: si algún día los archivos
  duelen, se cambia a SQLite sin tocar el resto.

## Espejo Obsidian (synapse-vault)

- Sync **unidireccional** AulaSmart → bóveda. La fuente de verdad es el JSON.
- Cada árbol escribe su outline en markdown (con wikilinks) en la bóveda; cada
  artefacto generado, también.
- Carpeta destino: **`05_Estudio/{materia}/`** (sección nueva de la bóveda, al nivel
  de las carpetas numeradas existentes). No se mezcla con las notas de Janus.
- Frontmatter compatible con la plantilla de la bóveda (`titulo`, `fecha`,
  `proyecto: aulasmart`, `tags`) **más `origen: aulasmart`**: se sabe que es
  autogenerado y que no se edita a mano ahí (la fuente de verdad es el JSON).

## El editor de árbol (criterios Miro)

- Canvas infinito, pan/zoom suaves, minimapa, "ajustar a vista".
- **Crear sin fricción:** doble click en lienzo = nodo; `Tab` = hijo; `Enter` =
  hermano; arrastrar desde el borde = conectar. Editar es escribir en el nodo,
  sin formularios.
- Colores y etiquetas por nodo; búsqueda dentro del canvas.
- Auto-layout (dagre) opcional que **respeta** las posiciones movidas a mano.
- **NO se copia de Miro (YAGNI):** multijugador, dibujo libre, plantillas.

## Módulos y fases

| Fase | Entrega | Criterio de hecho |
|---|---|---|
| **F0** | Esqueleto + storage + **editor completo sin IA** + espejo Obsidian básico | Usable desde el día 1; funciona al 100% sin API keys |
| **F1** | IA por nodo: **Verificar** e **Investigar** (router multimodelo) | El resultado se adjunta al nodo como nota con fuentes y cambia su estado |
| **F2** | Generador de **guion de estudio** | Recorre el árbol → markdown ordenado, guardado junto al árbol y espejado en la bóveda |
| **F3** | **Quiz/flashcards** desde el árbol | Con repaso espaciado (Leitner), como el módulo viejo pero alimentado por TU árbol |
| **F4** | **Slides** desde el árbol | Presentación navegable (teclado + fullscreen) para exposiciones |
| **F5** | **Ingesta**: PDF → borrador de árbol + búsqueda global | La IA propone; Antonio aprueba **nodo a nodo**. El PDF ya no termina en un quiz suelto: termina en su árbol |

## API (puertas traseras para Janus)

- `GET/POST/PUT/DELETE /api/arboles` y `/api/arboles/{id}` — CRUD completo.
- `POST /api/arboles/{id}/nodos` y mutaciones de nodos.
- `POST /api/nodos/{id}/verificar` · `POST /api/nodos/{id}/investigar`.
- `POST /api/generar/{guion|quiz|slides}`.
- `GET /api/buscar?q=` — búsqueda sobre todos los árboles y artefactos.
- Regla: **todo lo que hace la UI pasa por estas rutas.** Nada de lógica atrapada en
  componentes.

## Manejo de errores

- Sin claves de IA: el editor y la persistencia funcionan al 100% (la IA es capa
  opcional, no cimiento).
- Rotación silenciosa solo entre proveedores **gratuitos**; si todos fallan, mensaje
  claro — jamás escalar a Claude sin orden.
- Escrituras atómicas (ver persistencia); ante JSON corrupto, no sobrescribir:
  renombrar a `.broken` y avisar.

## Testing

- **vitest** sobre la lógica pura: modelo del árbol, storage, generadores, espejo
  Obsidian (rutas y frontmatter).
- El canvas se prueba a la manera de Antonio: él abre la app y reporta.

## Fuera de alcance (anti-goals)

- Canvas autogenerado por voz en tiempo real (el error del proyecto viejo).
- Multiusuario / SaaS.
- LLM local (Ollama) por ahora.
- WebSockets: si algo necesita "tiempo real", streaming HTTP como hasta ahora.
