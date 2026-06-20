# Estado — AulaSmart

> **Capa "en qué voy".** Lo volátil del ecosistema: el trabajo en curso y el
> siguiente paso — no qué es el repo (eso está en `README.md`/`AGENTS.md`) ni el
> porqué/narrativa (eso va a la bóveda Janus). **Una verdad por capa.**
> Convención: al **cerrar** trabajo aquí, actualiza este archivo; al **arrancar**,
> léelo primero. El launcher y las rutinas Janus leen este estado. No dupliques
> git (rama y último commit los lee el launcher en vivo).

**Actualizado:** 2026-06-19

## En qué voy
- Rama `feature/agent-aulasmart`. La **app core** (árboles de ideas, Next 16) tiene
  F0–F2 ✅; el roadmap del README sigue en F3 (quiz/Leitner), F4 (slides), F5 (ingesta PDF).
- Los últimos commits del repo **no son de la app** sino **docs de ContentOS**
  (specs/planes viven aquí en `docs/superpowers/`). ContentOS ya es repo propio
  (`C:\Workspace\contentos`); lo de aquí es solo histórico documental.
- Cambios sin commitear: `README.md` (actualización de esta tanda) y `AGENTS.md`
  (ver Notas). Apareció `.superpowers/` sin trackear.

## Próximo paso
- Resolver el working tree de `feature/agent-aulasmart` (commitear el README, decidir
  qué hacer con `.superpowers/`) y valorar merge a `main` — **a confirmar con Antonio**.
- Cuando se retome la app: siguiente hito del roadmap = **F3 (quiz/Leitner)**.

## Decisiones recientes
- ContentOS se separó a su propio repo; aquí solo quedan sus specs/planes en `docs/superpowers/`.

## Notas / bloqueos
- ⚠️ `AGENTS.md` se había **vaciado a 1 byte** en el working tree (rompía el
  `@AGENTS.md` de `CLAUDE.md` → la app perdía sus "4 reglas de oro"). **Restaurado
  desde HEAD** el 2026-06-19. Si vuelve a pasar, revisar qué herramienta lo reescribe.
