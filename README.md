# 🧠 AulaSmart — tus árboles de ideas

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![React Flow](https://img.shields.io/badge/React_Flow-12-ff0072)
![Local First](https://img.shields.io/badge/Filosofía-Local--first-22C55E)

**Mindmap-first.** Tú construyes tu árbol de ideas de estudio; la IA es la
empleada — verifica, investiga y genera material **desde tu árbol** (fases
F1+). Inspirado en el sistema de Nate Gentile: *el humano diseña, la IA
ejecuta*. Nunca al revés.

> Este proyecto refunda al antiguo `aulasmart-ai`, que invirtió esa relación
> (la IA dibujaba el mapa y el humano miraba). Spec completo en
> [`docs/superpowers/specs/`](docs/superpowers/specs/2026-06-12-aulasmart-refundacion-design.md).

## Arrancar

- **Doble click a `iniciar.bat`**, o `pnpm dev` — abre en <http://localhost:3002>.
- Funciona **al 100% sin API keys ni internet**: la IA es capa opcional (F1+),
  no cimiento.

## El editor (F0 — listo)

| Acción | Cómo |
|---|---|
| Crear hijo | `Tab` (del nodo seleccionado) o doble click en el lienzo |
| Crear hermano | `Enter` |
| Editar texto | doble click sobre el nodo o `F2` |
| Borrar nodo (y sus hijos) | `Supr` o el botón del panel |
| Mover | arrastrar (la posición queda guardada; ⇄ Reordenar vuelve al auto-layout) |
| Relación cruzada | arrastrar del borde de un nodo a otro; doble click sobre la flecha la quita |
| Notas, fuentes, estado, color, etiquetas | panel lateral del nodo seleccionado |
| Buscar | caja de búsqueda (Enter salta al primer resultado) |

Estados por nodo: **borrador** · **✅ verificado** · **⚠️ dudoso** — los decides tú.

## Dónde viven tus datos

- `data/arboles/{materia}/{tema}.json` — un archivo por árbol, legible y tuyo.
- `data/` es un **repo git propio**: cada guardado es un commit (historial de
  versiones gratis). Borrar = mover a `data/.papelera/` (recuperable).
- Escrituras atómicas: un crash jamás corrompe un árbol.

## Espejo en Obsidian

Cada guardado escribe el outline del árbol en tu bóveda:
`synapse-vault/05_Estudio/{materia}/{tema}.md` (frontmatter con
`origen: aulasmart`; **no editar a mano** — la fuente de verdad es el JSON).
Otra bóveda: variable de entorno `OBSIDIAN_VAULT_PATH`.

## API (puertas traseras para Janus)

```bash
curl localhost:3002/api/arboles                              # lista
curl -X POST localhost:3002/api/arboles -H 'Content-Type: application/json' \
     -d '{"materia":"Cálculo","tema":"Límites"}'             # crear
curl localhost:3002/api/arboles/calculo/limites              # leer
curl -X PUT ... (árbol completo)                             # guardar
curl -X DELETE localhost:3002/api/arboles/calculo/limites    # a la papelera
```

Regla de la casa: **todo lo que hace la UI pasa por estas rutas** — cualquier
agente (tu Janus) puede operar AulaSmart sin tocar la pantalla.

## Desarrollo

```bash
pnpm test        # vitest: modelo, storage, espejo, proyección a React Flow
pnpm tsc --noEmit && pnpm lint
pnpm build
```

## IA por nodo (F1 — lista)

Selecciona un nodo → panel lateral → **🔍 Verificar** (¿es correcto lo que
escribiste?) o **🔬 Investigar** (profundiza el punto). La respuesta llega a
las **notas** del nodo con sus **fuentes**, y el estado pasa a ✅/⚠️ según el
veredicto. Selector **Auto (gratis)** — rota Groq → Gemini — o **Claude
(pago)**, que *solo* responde si tú lo eliges; jamás por fallback.

Claves: copia `.env.example` a `.env.local` y rellena las que tengas
(`GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`).
Sin claves, los botones explican qué falta y el resto de la app no se entera.

## Roadmap

- **F0 — Editor de árbol** ✅
- **F1 — IA por nodo: Verificar / Investigar** ✅
- **F2 — Guion de estudio desde el árbol** ✅ — botón **📜 Guion**: recorre tu
  árbol y escribe `{tema}.guion.md` (secciones por rama, checklist de los ⚠️
  dudosos y fuentes) junto al árbol y en la bóveda
- **F3 — Flashcards con repaso Leitner** ✅ — botón **🎴** (con badge de cuántas
  tocan hoy): cada nodo es una tarjeta. Aciertas → sube de caja y vuelve más
  tarde; fallas → vuelve mañana. Progreso en `{tema}.repaso.json` (no se espeja).
- **F3.1 — Mazos multiformato (nivel Miro/Nate)** ✅ — botón **🪄** genera el
  mazo del árbol: **opción múltiple** además de voltear. Con clave de IA
  (Groq/Gemini gratis) las preguntas las redacta la IA en **una sola llamada**
  para todo el árbol; sin clave, se generan deterministas usando los conceptos
  hermanos como distractores. La sesión de repaso tiene **volteo 3D**, opción
  múltiple con feedback verde/rojo y barra de progreso. Mazo en `{tema}.tarjetas.json`.
  Atajos: Espacio voltea, 1-4 eligen opción, ←/→ responden.
- **F3.2 — Estadísticas + "repasar todo"** ✅ — al terminar (o si hoy no toca
  nada) ves un panel con tu progreso por caja Leitner y el % dominado, y un botón
  **Repasar todo** que ignora el calendario para repasar el tema entero antes de
  un examen. Además, CLI headless `pnpm pendientes` que Janus usa para avisarte.
- **F4 — Slides desde el árbol** ✅ — botón **🖼** genera `{tema}.slides.md`
  (presentación **Marp**: portada, índice, una slide por rama, repaso de los ⚠️
  dudosos y fuentes) junto al árbol y en la bóveda. Ábrela con Marp.
- **F5** — Ingesta: PDF → borrador de árbol que apruebas nodo a nodo

## El editor (atajos)

Botón **🎴** abre el modo repaso a pantalla completa. En el lienzo: doble click
crea sticky, `Tab` hijo, `Enter` hermano, `F2` editar, `Supr` borrar, arrastrar
mueve, arrastrar borde→borde conecta, la paleta pinta el sticky seleccionado,
**✨** abre el ayudante IA (solo si lo llamas).
