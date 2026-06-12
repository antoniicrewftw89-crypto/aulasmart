# AulaSmart F0 — Editor de árbol mindmap-first: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor de árboles de ideas completo y usable sin API keys: crear/editar/conectar nodos estilo Miro, persistencia atómica JSON+git en `data/`, API REST completa y espejo markdown en la bóveda Obsidian.

**Architecture:** Next.js 16 App Router. Lógica pura en `src/lib` (modelo del árbol, slugs, conversión a React Flow, outline markdown) testeada con vitest; storage en disco solo-servidor con escrituras atómicas y auto-commit git; route handlers delgados; el editor es un cliente React Flow que muta el árbol con las funciones del modelo y autosalva por PUT con debounce.

**Tech Stack:** Next.js 16.2.x · React 19.2 · Tailwind v4 · pnpm · `@xyflow/react` v12 · `@dagrejs/dagre` · vitest

**Reglas del spec que gobiernan todo el código:**
- La IA jamás escribe el árbol (F0 no tiene IA en absoluto).
- Todo lo que hace la UI pasa por `/api/*`.
- Sin claves ni red: la app funciona al 100%.
- Comentarios del código en español (preferencia de Antonio).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/arbol/types.ts` | Tipos del dominio (Arbol, NodoArbol, RelacionCruzada) |
| `src/lib/arbol/modelo.ts` | Mutaciones puras del árbol (agregar/editar/eliminar/mover/conectar) |
| `src/lib/arbol/slug.ts` | Slugificación de materia/tema |
| `src/lib/arbol/a-flow.ts` | Árbol → nodos/aristas de React Flow (+ layout dagre) |
| `src/lib/storage/arboles.ts` | Persistencia en disco: atómica, papelera, auto-commit git (solo servidor) |
| `src/lib/espejo/markdown.ts` | Árbol → outline markdown con frontmatter (puro) |
| `src/lib/espejo/obsidian.ts` | Escribir/borrar el espejo en la bóveda (solo servidor, nunca lanza) |
| `src/app/api/arboles/route.ts` | GET lista · POST crear |
| `src/app/api/arboles/[materia]/[tema]/route.ts` | GET · PUT · DELETE de un árbol |
| `src/app/page.tsx` + `src/components/lista-arboles.tsx` | Home: árboles por materia, crear, eliminar |
| `src/app/arbol/[materia]/[tema]/page.tsx` | Página del editor (server, pasa params) |
| `src/components/editor/editor-arbol.tsx` | Orquestador del canvas (React Flow, teclado, drag, conexión) |
| `src/components/editor/use-arbol-editor.ts` | Hook de estado: árbol, mutaciones, autosave debounced, búsqueda |
| `src/components/editor/nodo-idea.tsx` | Nodo custom: edición inline, estado, color, etiquetas |
| `src/components/editor/panel-nodo.tsx` | Panel lateral del nodo seleccionado (notas/fuentes/estado/color/etiquetas) |
| `src/components/editor/barra-superior.tsx` | Título, búsqueda, indicador de guardado, Reordenar, Volver |

Convención: ficheros y símbolos en español; sin clases — funciones puras que devuelven árboles nuevos.

---

### Task 1: Esqueleto del proyecto

**Files:** scaffold completo de create-next-app; Modify: `package.json`, `.gitignore`; Create: `vitest.config.ts`

- [ ] **Step 1: Scaffold de Next.js en la carpeta existente**

`docs/` y `.git/` están en la allowlist de create-next-app, así que se puede scaffoldear en el sitio:

```bash
cd /c/Workspace/aulasmart && pnpm dlx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-pnpm --yes
```

Si se negara por carpeta no vacía: scaffoldear en `/c/Workspace/aulasmart-tmp`, mover todo el contenido (menos `.git`) dentro de `aulasmart/` y borrar la temporal.

- [ ] **Step 2: Puerto fijo 3002 y dependencias**

En `package.json`, script dev: `"dev": "next dev --turbopack -p 3002"`.

```bash
cd /c/Workspace/aulasmart && pnpm add @xyflow/react @dagrejs/dagre && pnpm add -D vitest
```

- [ ] **Step 3: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

Añadir script `"test": "vitest run"` a `package.json`.

- [ ] **Step 4: .gitignore — ignorar `data/` (repo git anidado propio)**

Añadir al `.gitignore`: `/data/` y `*.broken-*`.

- [ ] **Step 5: Verificar que arranca y commitear**

Run: `pnpm dev` en background → `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002` → Expected: `200`. Parar el server.

```bash
git add -A && git commit -m "chore: esqueleto Next.js 16 + React Flow + vitest, puerto 3002"
```

---

### Task 2: Slugs

**Files:** Create: `src/lib/arbol/slug.ts` · Test: `src/lib/arbol/slug.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from "vitest";
import { slugificar } from "./slug";

describe("slugificar", () => {
  it("pasa a minúsculas y guiones", () => {
    expect(slugificar("Cálculo Diferencial")).toBe("calculo-diferencial");
  });
  it("limpia símbolos y bordes", () => {
    expect(slugificar("  ¡Límites & Derivadas! ")).toBe("limites-derivadas");
  });
  it("nunca devuelve vacío", () => {
    expect(slugificar("¿?¡!")).toBe("sin-titulo");
  });
});
```

- [ ] **Step 2: Run y ver fallo** — `pnpm vitest run src/lib/arbol/slug.test.ts` → FAIL (módulo no existe)

- [ ] **Step 3: Implementación**

```ts
// Convierte un texto libre (materia/tema) en slug seguro para carpeta/URL.
export function slugificar(texto: string): string {
  const slug = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sin tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sin-titulo";
}
```

- [ ] **Step 4: Run → PASS**  ·  **Step 5: Commit** `feat: slugificar materia/tema`

---

### Task 3: Tipos y modelo del árbol

**Files:** Create: `src/lib/arbol/types.ts`, `src/lib/arbol/modelo.ts` · Test: `src/lib/arbol/modelo.test.ts`

- [ ] **Step 1: Tipos (sin test — solo declaraciones)**

```ts
// types.ts — El dominio completo de AulaSmart F0.
export type EstadoNodo = "borrador" | "verificado" | "dudoso";

export interface NodoArbol {
  id: string;
  texto: string;
  notas: string;
  fuentes: string[];
  estado: EstadoNodo;
  color: string | null;       // hex de la paleta, null = neutro
  etiquetas: string[];
  posicion: { x: number; y: number } | null; // null = la decide el auto-layout
  padreId: string | null;     // null SOLO en la raíz
  orden: number;              // orden entre hermanos
}

export interface RelacionCruzada {
  id: string;
  desdeId: string;
  hastaId: string;
  etiqueta: string;
}

export interface Arbol {
  version: 1;
  materia: string;  // slug
  tema: string;     // slug
  titulo: string;   // texto visible
  nodos: NodoArbol[];
  relaciones: RelacionCruzada[];
  creadoEn: string;      // ISO
  actualizadoEn: string; // ISO
}

export interface ResumenArbol {
  materia: string;
  tema: string;
  titulo: string;
  nNodos: number;
  actualizadoEn: string;
}
```

- [ ] **Step 2: Tests del modelo (fallan)**

```ts
import { describe, expect, it } from "vitest";
import {
  agregarHermano, agregarHijo, conectar, crearArbol, descendientesDe,
  desconectar, editarNodo, eliminarNodo, hijosDe, moverNodo, raizDe, validarArbol,
} from "./modelo";

const base = () => crearArbol("calculo", "limites", "Límites");

describe("modelo del árbol", () => {
  it("crearArbol crea raíz única con el título", () => {
    const a = base();
    const raiz = raizDe(a);
    expect(raiz.texto).toBe("Límites");
    expect(raiz.padreId).toBeNull();
    expect(a.nodos).toHaveLength(1);
    expect(validarArbol(a)).toEqual([]);
  });

  it("agregarHijo cuelga del padre con orden incremental", () => {
    let { arbol: a, nodo: h1 } = agregarHijo(base(), raizDe(base()).id);
    // ojo: usar la MISMA instancia para ids coherentes
    const a0 = base();
    ({ arbol: a, nodo: h1 } = agregarHijo(a0, raizDe(a0).id, "definición"));
    const { arbol: a2, nodo: h2 } = agregarHijo(a, raizDe(a).id, "propiedades");
    expect(hijosDe(a2, raizDe(a2).id).map(n => n.texto)).toEqual(["definición", "propiedades"]);
    expect(h2.orden).toBeGreaterThan(h1.orden);
  });

  it("agregarHermano de la raíz devuelve null", () => {
    const a = base();
    expect(agregarHermano(a, raizDe(a).id)).toBeNull();
  });

  it("eliminarNodo borra descendientes y relaciones colgantes; raíz prohibida", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    const { arbol: a2, nodo: n } = agregarHijo(a1, h.id, "nieto");
    const a3 = conectar(a2, n.id, raizDe(a2).id, "ver");
    const a4 = eliminarNodo(a3, h.id);
    expect(a4.nodos).toHaveLength(1);
    expect(a4.relaciones).toHaveLength(0);
    expect(eliminarNodo(a4, raizDe(a4).id)).toBe(a4); // no-op
  });

  it("moverNodo rechaza moverse a un descendiente propio", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    const { arbol: a2, nodo: n } = agregarHijo(a1, h.id, "nieto");
    expect(moverNodo(a2, h.id, n.id)).toBe(a2); // no-op
    const { arbol: a3, nodo: h2 } = agregarHijo(a2, raizDe(a2).id, "h2");
    const a4 = moverNodo(a3, n.id, h2.id);
    expect(a4.nodos.find(x => x.id === n.id)!.padreId).toBe(h2.id);
  });

  it("conectar evita duplicados, self-loops y duplicar la jerarquía", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    expect(conectar(a1, h.id, h.id)).toBe(a1);                    // self
    expect(conectar(a1, raizDe(a1).id, h.id)).toBe(a1);           // ya es arista jerárquica
    const a2 = conectar(a1, h.id, raizDe(a1).id, "vuelve");
    expect(a2.relaciones).toHaveLength(1);
    expect(conectar(a2, h.id, raizDe(a2).id)).toBe(a2);           // duplicada
    expect(desconectar(a2, a2.relaciones[0].id).relaciones).toHaveLength(0);
  });

  it("editarNodo cambia campos y actualiza actualizadoEn", () => {
    const a = base();
    const id = raizDe(a).id;
    const a2 = editarNodo(a, id, { estado: "verificado", notas: "ok" });
    expect(a2.nodos[0].estado).toBe("verificado");
    expect(a2.nodos[0].notas).toBe("ok");
  });

  it("validarArbol detecta huérfanos y multi-raíz", () => {
    const a = base();
    const roto = { ...a, nodos: [...a.nodos, { ...a.nodos[0], id: "x", padreId: "no-existe" }] };
    expect(validarArbol(roto).length).toBeGreaterThan(0);
  });

  it("descendientesDe devuelve todos los niveles", () => {
    const a0 = base();
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "h");
    const { arbol: a2, nodo: n } = agregarHijo(a1, h.id, "nieto");
    expect(descendientesDe(a2, raizDe(a2).id).sort()).toEqual([h.id, n.id].sort());
  });
});
```

- [ ] **Step 3: Run → FAIL**  — `pnpm vitest run src/lib/arbol/modelo.test.ts`

- [ ] **Step 4: Implementación**

```ts
// modelo.ts — Mutaciones puras: cada función devuelve un Árbol NUEVO.
// La IA jamás llama a esto por su cuenta: solo la UI/API a petición del humano.
import type { Arbol, EstadoNodo, NodoArbol } from "./types";

export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const ahora = () => new Date().toISOString();
const tocar = (a: Arbol): Arbol => ({ ...a, actualizadoEn: ahora() });

export function crearArbol(materia: string, tema: string, titulo: string): Arbol {
  const raiz: NodoArbol = {
    id: nuevoId(), texto: titulo, notas: "", fuentes: [], estado: "borrador",
    color: null, etiquetas: [], posicion: null, padreId: null, orden: 0,
  };
  const t = ahora();
  return { version: 1, materia, tema, titulo, nodos: [raiz], relaciones: [], creadoEn: t, actualizadoEn: t };
}

export const raizDe = (a: Arbol): NodoArbol => a.nodos.find(n => n.padreId === null)!;

export const hijosDe = (a: Arbol, id: string): NodoArbol[] =>
  a.nodos.filter(n => n.padreId === id).sort((x, y) => x.orden - y.orden);

export function descendientesDe(a: Arbol, id: string): string[] {
  const directos = a.nodos.filter(n => n.padreId === id).map(n => n.id);
  return directos.flatMap(d => [d, ...descendientesDe(a, d)]);
}

export function agregarHijo(a: Arbol, padreId: string, texto = ""): { arbol: Arbol; nodo: NodoArbol } {
  const hermanos = hijosDe(a, padreId);
  const nodo: NodoArbol = {
    id: nuevoId(), texto, notas: "", fuentes: [], estado: "borrador",
    color: null, etiquetas: [], posicion: null, padreId,
    orden: hermanos.length ? hermanos[hermanos.length - 1].orden + 1 : 0,
  };
  return { arbol: tocar({ ...a, nodos: [...a.nodos, nodo] }), nodo };
}

export function agregarHermano(a: Arbol, nodoId: string, texto = ""): { arbol: Arbol; nodo: NodoArbol } | null {
  const ref = a.nodos.find(n => n.id === nodoId);
  if (!ref || ref.padreId === null) return null; // la raíz no tiene hermanos
  const nodo: NodoArbol = {
    id: nuevoId(), texto, notas: "", fuentes: [], estado: "borrador",
    color: null, etiquetas: [], posicion: null, padreId: ref.padreId, orden: ref.orden + 0.5,
  };
  // renormalizar orden a enteros
  const arbol = tocar({ ...a, nodos: [...a.nodos, nodo] });
  const renum = hijosDe(arbol, ref.padreId).map((n, i) => ({ ...n, orden: i }));
  return {
    arbol: { ...arbol, nodos: arbol.nodos.map(n => renum.find(r => r.id === n.id) ?? n) },
    nodo: renum.find(r => r.id === nodo.id) ?? nodo,
  };
}

export type CambiosNodo = Partial<Pick<NodoArbol, "texto" | "notas" | "fuentes" | "estado" | "color" | "etiquetas" | "posicion">>;

export function editarNodo(a: Arbol, id: string, cambios: CambiosNodo): Arbol {
  if (!a.nodos.some(n => n.id === id)) return a;
  return tocar({ ...a, nodos: a.nodos.map(n => (n.id === id ? { ...n, ...cambios } : n)) });
}

export function eliminarNodo(a: Arbol, id: string): Arbol {
  const nodo = a.nodos.find(n => n.id === id);
  if (!nodo || nodo.padreId === null) return a; // la raíz no se borra
  const fuera = new Set([id, ...descendientesDe(a, id)]);
  return tocar({
    ...a,
    nodos: a.nodos.filter(n => !fuera.has(n.id)),
    relaciones: a.relaciones.filter(r => !fuera.has(r.desdeId) && !fuera.has(r.hastaId)),
  });
}

export function moverNodo(a: Arbol, id: string, nuevoPadreId: string): Arbol {
  const nodo = a.nodos.find(n => n.id === id);
  if (!nodo || nodo.padreId === null || id === nuevoPadreId) return a;
  if (!a.nodos.some(n => n.id === nuevoPadreId)) return a;
  if (descendientesDe(a, id).includes(nuevoPadreId)) return a; // ciclo
  const hermanos = hijosDe(a, nuevoPadreId);
  const orden = hermanos.length ? hermanos[hermanos.length - 1].orden + 1 : 0;
  return tocar({ ...a, nodos: a.nodos.map(n => (n.id === id ? { ...n, padreId: nuevoPadreId, orden } : n)) });
}

export function conectar(a: Arbol, desdeId: string, hastaId: string, etiqueta = ""): Arbol {
  if (desdeId === hastaId) return a;
  const existen = a.nodos.map(n => n.id);
  if (!existen.includes(desdeId) || !existen.includes(hastaId)) return a;
  const hasta = a.nodos.find(n => n.id === hastaId)!;
  const desde = a.nodos.find(n => n.id === desdeId)!;
  if (hasta.padreId === desdeId || desde.padreId === hastaId) return a; // ya unidos por jerarquía
  if (a.relaciones.some(r => (r.desdeId === desdeId && r.hastaId === hastaId) || (r.desdeId === hastaId && r.hastaId === desdeId))) return a;
  return tocar({ ...a, relaciones: [...a.relaciones, { id: nuevoId(), desdeId, hastaId, etiqueta }] });
}

export const desconectar = (a: Arbol, relId: string): Arbol =>
  tocar({ ...a, relaciones: a.relaciones.filter(r => r.id !== relId) });

/** Devuelve la lista de problemas; árbol sano = []. */
export function validarArbol(a: Arbol): string[] {
  const errores: string[] = [];
  if (a.version !== 1) errores.push("versión desconocida");
  const raices = a.nodos.filter(n => n.padreId === null);
  if (raices.length !== 1) errores.push(`debe haber exactamente 1 raíz (hay ${raices.length})`);
  const ids = new Set(a.nodos.map(n => n.id));
  if (ids.size !== a.nodos.length) errores.push("ids de nodo duplicados");
  for (const n of a.nodos)
    if (n.padreId !== null && !ids.has(n.padreId)) errores.push(`nodo ${n.id} huérfano (padre ${n.padreId} no existe)`);
  for (const r of a.relaciones)
    if (!ids.has(r.desdeId) || !ids.has(r.hastaId)) errores.push(`relación ${r.id} apunta a nodos inexistentes`);
  const estados: EstadoNodo[] = ["borrador", "verificado", "dudoso"];
  for (const n of a.nodos) if (!estados.includes(n.estado)) errores.push(`estado inválido en ${n.id}`);
  return errores;
}
```

- [ ] **Step 5: Run → PASS**  ·  **Step 6: Commit** `feat: tipos y modelo puro del árbol con validación`

---

### Task 4: Storage en disco (atómico + papelera + git)

**Files:** Create: `src/lib/storage/arboles.ts` · Test: `src/lib/storage/arboles.test.ts`

- [ ] **Step 1: Tests (fallan)**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crearArbol } from "../arbol/modelo";
import { eliminarArbol, guardarArbol, leerArbol, listarArboles, rutaArbol } from "./arboles";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "aulasmart-test-"));
  process.env.AULASMART_DATA = dir;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("storage de árboles", () => {
  it("guarda y lee un árbol idéntico", () => {
    const a = crearArbol("calculo", "limites", "Límites");
    guardarArbol(a);
    expect(leerArbol("calculo", "limites")).toEqual(a);
    expect(fs.existsSync(rutaArbol("calculo", "limites"))).toBe(true);
  });

  it("leerArbol devuelve null si no existe", () => {
    expect(leerArbol("nada", "nada")).toBeNull();
  });

  it("listarArboles resume por materia", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    guardarArbol(crearArbol("algoritmos", "grafos", "Grafos"));
    const lista = listarArboles();
    expect(lista).toHaveLength(2);
    expect(lista.map(r => r.materia).sort()).toEqual(["algoritmos", "calculo"]);
    expect(lista[0].nNodos).toBe(1);
  });

  it("eliminarArbol mueve a la papelera (recuperable)", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    expect(eliminarArbol("calculo", "limites")).toBe(true);
    expect(leerArbol("calculo", "limites")).toBeNull();
    const papelera = path.join(dir, ".papelera");
    expect(fs.readdirSync(papelera).length).toBe(1);
  });

  it("un JSON corrupto no tumba el listado: se renombra a .broken", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    fs.writeFileSync(rutaArbol("calculo", "limites"), "{ basura");
    expect(listarArboles()).toHaveLength(0);
    const archivos = fs.readdirSync(path.join(dir, "arboles", "calculo"));
    expect(archivos.some(f => f.includes(".broken-"))).toBe(true);
  });

  it("data/ queda como repo git con commits", () => {
    guardarArbol(crearArbol("calculo", "limites", "Límites"));
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL**  — `pnpm vitest run src/lib/storage/arboles.test.ts`

- [ ] **Step 3: Implementación**

```ts
// arboles.ts — Persistencia local-first. SOLO servidor (usa fs).
// Reglas: escritura atómica (tmp+rename), borrado = papelera, cada guardado
// queda commiteado en el repo git de data/ (las "versiones" del mindmap).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Arbol, ResumenArbol } from "../arbol/types";

const base = () => process.env.AULASMART_DATA ?? path.join(process.cwd(), "data");
const dirArboles = () => path.join(base(), "arboles");

export const rutaArbol = (materia: string, tema: string) =>
  path.join(dirArboles(), materia, `${tema}.json`);

function git(args: string[]): void {
  // Nunca dejar que git tumbe un guardado: el commit es mejora, no requisito.
  try {
    execFileSync("git", ["-c", "user.name=AulaSmart", "-c", "user.email=aulasmart@local", ...args], {
      cwd: base(), stdio: "ignore",
    });
  } catch { /* sin git o sin cambios: seguir */ }
}

function asegurarRepo(): void {
  fs.mkdirSync(dirArboles(), { recursive: true });
  if (!fs.existsSync(path.join(base(), ".git"))) git(["init"]);
}

export function guardarArbol(a: Arbol): void {
  asegurarRepo();
  const destino = rutaArbol(a.materia, a.tema);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(a, null, 2), "utf8");
  fs.renameSync(tmp, destino); // atómico: o está el viejo o el nuevo, jamás a medias
  git(["add", "-A"]);
  git(["commit", "-m", `autosave: ${a.materia}/${a.tema}`, "--quiet"]);
}

export function leerArbol(materia: string, tema: string): Arbol | null {
  const ruta = rutaArbol(materia, tema);
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as Arbol;
  } catch {
    // JSON corrupto: apartarlo con timestamp, no sobreescribir jamás
    fs.renameSync(ruta, `${ruta}.broken-${Date.now()}`);
    return null;
  }
}

export function listarArboles(): ResumenArbol[] {
  if (!fs.existsSync(dirArboles())) return [];
  const resumen: ResumenArbol[] = [];
  for (const materia of fs.readdirSync(dirArboles(), { withFileTypes: true })) {
    if (!materia.isDirectory()) continue;
    for (const archivo of fs.readdirSync(path.join(dirArboles(), materia.name))) {
      if (!archivo.endsWith(".json")) continue;
      const a = leerArbol(materia.name, archivo.replace(/\.json$/, ""));
      if (a) resumen.push({ materia: a.materia, tema: a.tema, titulo: a.titulo, nNodos: a.nodos.length, actualizadoEn: a.actualizadoEn });
    }
  }
  return resumen.sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn));
}

export function eliminarArbol(materia: string, tema: string): boolean {
  const ruta = rutaArbol(materia, tema);
  if (!fs.existsSync(ruta)) return false;
  const papelera = path.join(base(), ".papelera");
  fs.mkdirSync(papelera, { recursive: true });
  fs.renameSync(ruta, path.join(papelera, `${materia}--${tema}--${Date.now()}.json`));
  git(["add", "-A"]);
  git(["commit", "-m", `papelera: ${materia}/${tema}`, "--quiet"]);
  return true;
}
```

- [ ] **Step 4: Run → PASS**  ·  **Step 5: Commit** `feat: storage atómico con papelera y versionado git en data/`

---

### Task 5: Outline markdown (espejo, parte pura)

**Files:** Create: `src/lib/espejo/markdown.ts` · Test: `src/lib/espejo/markdown.test.ts`

- [ ] **Step 1: Tests (fallan)**

```ts
import { describe, expect, it } from "vitest";
import { agregarHijo, conectar, crearArbol, editarNodo, raizDe } from "../arbol/modelo";
import { generarOutlineMd } from "./markdown";

describe("generarOutlineMd", () => {
  it("frontmatter compatible con la bóveda + aviso de autogenerado", () => {
    const md = generarOutlineMd(crearArbol("calculo", "limites", "Límites"));
    expect(md).toContain("proyecto: aulasmart");
    expect(md).toContain("origen: aulasmart");
    expect(md).toContain("tags: [estudio, calculo]");
    expect(md).toContain("No editar a mano");
  });

  it("outline anidado con estados", () => {
    const a0 = crearArbol("calculo", "limites", "Límites");
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2 } = agregarHijo(a1, h.id, "épsilon-delta");
    const a3 = editarNodo(a2, h.id, { estado: "verificado", notas: "visto en clase" });
    const md = generarOutlineMd(a3);
    expect(md).toContain("- Límites");
    expect(md).toContain("  - ✅ definición");
    expect(md).toContain("    - _notas:_ visto en clase");
    expect(md).toContain("    - épsilon-delta");
  });

  it("lista las relaciones cruzadas", () => {
    const a0 = crearArbol("calculo", "limites", "Límites");
    const { arbol: a1, nodo: h } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2, nodo: h2 } = agregarHijo(a1, raizDe(a1).id, "continuidad");
    const a3 = conectar(a2, h.id, h2.id, "se usa en");
    expect(generarOutlineMd(a3)).toContain("definición → continuidad (se usa en)");
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementación**

```ts
// markdown.ts — Árbol → outline .md para la bóveda Obsidian. Función PURA.
import type { Arbol, NodoArbol } from "../arbol/types";
import { hijosDe, raizDe } from "../arbol/modelo";

const ICONO = { borrador: "", verificado: "✅ ", dudoso: "⚠️ " } as const;

function lineas(a: Arbol, nodo: NodoArbol, nivel: number): string[] {
  const sangria = "  ".repeat(nivel);
  const out = [`${sangria}- ${ICONO[nodo.estado]}${nodo.texto || "(sin texto)"}`];
  if (nodo.notas.trim()) out.push(`${sangria}  - _notas:_ ${nodo.notas.trim().replace(/\r?\n/g, " ")}`);
  for (const f of nodo.fuentes) out.push(`${sangria}  - _fuente:_ ${f}`);
  for (const hijo of hijosDe(a, nodo.id)) out.push(...lineas(a, hijo, nivel + 1));
  return out;
}

export function generarOutlineMd(a: Arbol): string {
  const fecha = a.actualizadoEn.slice(0, 10);
  const cuerpo = lineas(a, raizDe(a), 0).join("\n");
  const relaciones = a.relaciones.map(r => {
    const de = a.nodos.find(n => n.id === r.desdeId)?.texto ?? "?";
    const hasta = a.nodos.find(n => n.id === r.hastaId)?.texto ?? "?";
    return `- ${de} → ${hasta}${r.etiqueta ? ` (${r.etiqueta})` : ""}`;
  });
  return [
    "---",
    `titulo: ${a.titulo}`,
    `fecha: ${fecha}`,
    "proyecto: aulasmart",
    `tags: [estudio, ${a.materia}]`,
    "origen: aulasmart",
    "---",
    "",
    `# ${a.titulo}`,
    "",
    `> Archivo autogenerado por AulaSmart. No editar a mano: la fuente de verdad es \`data/arboles/${a.materia}/${a.tema}.json\`.`,
    "",
    cuerpo,
    ...(relaciones.length ? ["", "## Relaciones", "", ...relaciones] : []),
    "",
  ].join("\n");
}
```

- [ ] **Step 4: Run → PASS**  ·  **Step 5: Commit** `feat: outline markdown del árbol para la bóveda`

---

### Task 6: Escritor del espejo Obsidian

**Files:** Create: `src/lib/espejo/obsidian.ts` · Test: `src/lib/espejo/obsidian.test.ts`

- [ ] **Step 1: Tests (fallan)** — el escritor recibe la ruta de la bóveda por parámetro (default: env/`C:\Workspace\synapse-vault`); si la bóveda no existe, NO crea nada y devuelve `false`.

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crearArbol } from "../arbol/modelo";
import { borrarEspejo, espejarArbol } from "./obsidian";

let vault: string;
beforeEach(() => { vault = fs.mkdtempSync(path.join(os.tmpdir(), "vault-test-")); });
afterEach(() => fs.rmSync(vault, { recursive: true, force: true }));

describe("espejo Obsidian", () => {
  it("escribe el outline en 05_Estudio/{materia}/{tema}.md", () => {
    const ok = espejarArbol(crearArbol("calculo", "limites", "Límites"), vault);
    expect(ok).toBe(true);
    const ruta = path.join(vault, "05_Estudio", "calculo", "limites.md");
    expect(fs.readFileSync(ruta, "utf8")).toContain("origen: aulasmart");
  });

  it("si la bóveda no existe, no inventa carpetas y devuelve false", () => {
    expect(espejarArbol(crearArbol("c", "t", "T"), path.join(vault, "no-existe"))).toBe(false);
  });

  it("borrarEspejo quita el archivo y tolera que no exista", () => {
    espejarArbol(crearArbol("calculo", "limites", "Límites"), vault);
    expect(borrarEspejo("calculo", "limites", vault)).toBe(true);
    expect(borrarEspejo("calculo", "limites", vault)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementación**

```ts
// obsidian.ts — Espejo unidireccional AulaSmart → bóveda. SOLO servidor.
// Nunca lanza: si la bóveda no está, la app sigue funcionando igual.
import fs from "node:fs";
import path from "node:path";
import type { Arbol } from "../arbol/types";
import { generarOutlineMd } from "./markdown";

const RUTA_BOVEDA = () => process.env.OBSIDIAN_VAULT_PATH ?? "C:\\Workspace\\synapse-vault";
const CARPETA_ESTUDIO = "05_Estudio";

export function espejarArbol(a: Arbol, boveda: string = RUTA_BOVEDA()): boolean {
  try {
    if (!fs.existsSync(boveda)) return false; // bóveda apagada/movida: no inventar rutas
    const dir = path.join(boveda, CARPETA_ESTUDIO, a.materia);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${a.tema}.md`), generarOutlineMd(a), "utf8");
    return true;
  } catch { return false; }
}

export function borrarEspejo(materia: string, tema: string, boveda: string = RUTA_BOVEDA()): boolean {
  try {
    const ruta = path.join(boveda, CARPETA_ESTUDIO, materia, `${tema}.md`);
    if (!fs.existsSync(ruta)) return false;
    fs.unlinkSync(ruta);
    return true;
  } catch { return false; }
}
```

- [ ] **Step 4: Run → PASS**  ·  **Step 5: Commit** `feat: espejo unidireccional a la bóveda Obsidian`

---

### Task 7: API REST

**Files:** Create: `src/app/api/arboles/route.ts`, `src/app/api/arboles/[materia]/[tema]/route.ts`

Next 16: `params` es **Promise** en route handlers → siempre `await params`.

- [ ] **Step 1: Colección — lista y alta**

```ts
// src/app/api/arboles/route.ts — GET lista · POST crear.
// Handlers delgados: el trabajo real vive en lib (testeado con vitest).
import { NextResponse } from "next/server";
import { crearArbol } from "@/lib/arbol/modelo";
import { slugificar } from "@/lib/arbol/slug";
import { guardarArbol, leerArbol, listarArboles } from "@/lib/storage/arboles";
import { espejarArbol } from "@/lib/espejo/obsidian";

export async function GET() {
  return NextResponse.json(listarArboles());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const materiaTxt = typeof body?.materia === "string" ? body.materia.trim() : "";
  const temaTxt = typeof body?.tema === "string" ? body.tema.trim() : "";
  if (!materiaTxt || !temaTxt) {
    return NextResponse.json({ error: "materia y tema son obligatorios" }, { status: 400 });
  }
  const materia = slugificar(materiaTxt);
  const tema = slugificar(temaTxt);
  if (leerArbol(materia, tema)) {
    return NextResponse.json({ error: `ya existe ${materia}/${tema}` }, { status: 409 });
  }
  const arbol = crearArbol(materia, tema, temaTxt);
  guardarArbol(arbol);
  espejarArbol(arbol);
  return NextResponse.json(arbol, { status: 201 });
}
```

- [ ] **Step 2: Recurso — leer, guardar, borrar**

```ts
// src/app/api/arboles/[materia]/[tema]/route.ts — GET · PUT · DELETE.
import { NextResponse } from "next/server";
import { validarArbol } from "@/lib/arbol/modelo";
import type { Arbol } from "@/lib/arbol/types";
import { eliminarArbol, guardarArbol, leerArbol } from "@/lib/storage/arboles";
import { borrarEspejo, espejarArbol } from "@/lib/espejo/obsidian";

type Params = { params: Promise<{ materia: string; tema: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const arbol = leerArbol(materia, tema);
  return arbol
    ? NextResponse.json(arbol)
    : NextResponse.json({ error: "no existe" }, { status: 404 });
}

export async function PUT(req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const body = (await req.json().catch(() => null)) as Arbol | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  if (body.materia !== materia || body.tema !== tema) {
    return NextResponse.json({ error: "materia/tema no coinciden con la URL" }, { status: 400 });
  }
  const errores = validarArbol(body);
  if (errores.length) return NextResponse.json({ error: "árbol inválido", detalles: errores }, { status: 422 });
  guardarArbol(body);
  espejarArbol(body);
  return NextResponse.json({ ok: true, actualizadoEn: body.actualizadoEn });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { materia, tema } = await params;
  const ok = eliminarArbol(materia, tema);
  if (ok) borrarEspejo(materia, tema);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "no existe" }, { status: 404 });
}
```

- [ ] **Step 3: Smoke con curl** (server dev corriendo):

```bash
curl -s -X POST localhost:3002/api/arboles -H 'Content-Type: application/json' -d '{"materia":"Cálculo","tema":"Límites"}'   # 201, árbol con raíz
curl -s localhost:3002/api/arboles                       # lista con 1 resumen
curl -s localhost:3002/api/arboles/calculo/limites       # árbol completo
curl -s -X DELETE localhost:3002/api/arboles/calculo/limites  # {"ok":true}
```

Verificar también que apareció y desapareció `synapse-vault/05_Estudio/calculo/limites.md` y que `data/` tiene commits (`git -C data log --oneline`).

- [ ] **Step 4: Commit** `feat: API REST de árboles (lista/alta/lectura/guardado/papelera)`

---

### Task 8: Conversión árbol → React Flow (con layout dagre)

**Files:** Create: `src/lib/arbol/a-flow.ts` · Test: `src/lib/arbol/a-flow.test.ts`

- [ ] **Step 1: Tests (fallan)**

```ts
import { describe, expect, it } from "vitest";
import { agregarHijo, conectar, crearArbol, editarNodo, raizDe } from "./modelo";
import { aFlow } from "./a-flow";

describe("aFlow", () => {
  const arma = () => {
    const a0 = crearArbol("calculo", "limites", "Límites");
    const { arbol: a1, nodo: h1 } = agregarHijo(a0, raizDe(a0).id, "definición");
    const { arbol: a2, nodo: h2 } = agregarHijo(a1, raizDe(a1).id, "continuidad");
    return { a: conectar(a2, h1.id, h2.id, "se usa en"), h1, h2 };
  };

  it("genera un node por nodo y aristas jerárquicas + cruzadas", () => {
    const { a } = arma();
    const { nodes, edges } = aFlow(a);
    expect(nodes).toHaveLength(3);
    expect(edges.filter(e => e.id.startsWith("j-"))).toHaveLength(2);
    expect(edges.filter(e => e.id.startsWith("r-"))).toHaveLength(1);
  });

  it("el layout posiciona sin solapar y respeta posiciones manuales", () => {
    const { a, h1 } = arma();
    const fijado = editarNodo(a, h1.id, { posicion: { x: 999, y: 111 } });
    const { nodes } = aFlow(fijado);
    const fijo = nodes.find(n => n.id === h1.id)!;
    expect(fijo.position).toEqual({ x: 999, y: 111 });
    const resto = nodes.filter(n => n.id !== h1.id);
    expect(new Set(resto.map(n => `${n.position.x},${n.position.y}`)).size).toBe(resto.length);
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementación**

```ts
// a-flow.ts — Proyección del Árbol al formato de React Flow + auto-layout.
// dagre decide posiciones SOLO para nodos sin posicion manual.
import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { Arbol, NodoArbol } from "./types";

export type DatosNodoIdea = { nodo: NodoArbol };

const ANCHO = (n: NodoArbol) => Math.min(280, Math.max(140, 60 + n.texto.length * 7));
const ALTO = 52;

export function aFlow(a: Arbol): { nodes: Node<DatosNodoIdea>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of a.nodos) g.setNode(n.id, { width: ANCHO(n), height: ALTO });
  for (const n of a.nodos) if (n.padreId) g.setEdge(n.padreId, n.id);
  dagre.layout(g);

  const nodes: Node<DatosNodoIdea>[] = a.nodos.map(n => ({
    id: n.id,
    type: "idea",
    position: n.posicion ?? { x: g.node(n.id).x - ANCHO(n) / 2, y: g.node(n.id).y - ALTO / 2 },
    data: { nodo: n },
  }));

  const edges: Edge[] = [
    ...a.nodos.filter(n => n.padreId).map(n => ({
      id: `j-${n.id}`, source: n.padreId!, target: n.id, type: "smoothstep" as const,
    })),
    ...a.relaciones.map(r => ({
      id: `r-${r.id}`, source: r.desdeId, target: r.hastaId, label: r.etiqueta || undefined,
      animated: true, style: { strokeDasharray: "6 4" },
    })),
  ];
  return { nodes, edges };
}
```

- [ ] **Step 4: Run → PASS**  ·  **Step 5: Commit** `feat: proyección del árbol a React Flow con dagre`

---

### Task 9: Home — lista de árboles

**Files:** Modify: `src/app/page.tsx`, `src/app/layout.tsx` (metadata + lang es) · Create: `src/components/lista-arboles.tsx`

- [ ] **Step 1: layout.tsx** — `lang="es"`, título "AulaSmart", descripción corta. Mantener las fuentes Geist del scaffold.

- [ ] **Step 2: page.tsx**

```tsx
import { ListaArboles } from "@/components/lista-arboles";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">🧠 AulaSmart</h1>
        <p className="text-sm text-neutral-400">Tus árboles de ideas. Tú piensas; la IA te ayudará donde se lo pidas.</p>
      </header>
      <ListaArboles />
    </main>
  );
}
```

- [ ] **Step 3: lista-arboles.tsx** (cliente). Comportamiento: carga `GET /api/arboles`; agrupa por materia; tarjeta por árbol con título, nº de nodos, fecha relativa y botón eliminar (con `confirm()`); formulario inline "Materia + Tema" → `POST /api/arboles` → navega a `/arbol/{materia}/{tema}`; estados de carga/vacío/error visibles.

```tsx
"use client";
// Lista de árboles agrupada por materia. TODO pasa por la API (regla del spec).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumenArbol } from "@/lib/arbol/types";

export function ListaArboles() {
  const router = useRouter();
  const [arboles, setArboles] = useState<ResumenArbol[] | null>(null);
  const [error, setError] = useState("");
  const [materia, setMateria] = useState("");
  const [tema, setTema] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/arboles");
      setArboles(await res.json());
    } catch { setError("No se pudo cargar la lista"); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true); setError("");
    const res = await fetch("/api/arboles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia, tema }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) { setError(data.error ?? "error al crear"); return; }
    router.push(`/arbol/${data.materia}/${data.tema}`);
  }

  async function eliminar(r: ResumenArbol) {
    if (!confirm(`¿Enviar "${r.titulo}" a la papelera? (recuperable en data/.papelera)`)) return;
    await fetch(`/api/arboles/${r.materia}/${r.tema}`, { method: "DELETE" });
    cargar();
  }

  const porMateria = new Map<string, ResumenArbol[]>();
  for (const r of arboles ?? []) porMateria.set(r.materia, [...(porMateria.get(r.materia) ?? []), r]);

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={crear} className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Materia
          <input value={materia} onChange={e => setMateria(e.target.value)} placeholder="Cálculo Diferencial"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Tema
          <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Límites"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500" />
        </label>
        <button disabled={creando || !materia.trim() || !tema.trim()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-40">
          {creando ? "Creando…" : "＋ Nuevo árbol"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {arboles === null && <p className="text-neutral-500">Cargando…</p>}
      {arboles?.length === 0 && <p className="text-neutral-500">Aún no hay árboles. Crea el primero arriba: tú pones las ideas.</p>}

      {[...porMateria.entries()].map(([m, lista]) => (
        <section key={m}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">{m}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lista.map(r => (
              <li key={`${r.materia}/${r.tema}`}
                className="group flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 hover:border-emerald-600">
                <a href={`/arbol/${r.materia}/${r.tema}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.titulo}</p>
                  <p className="text-xs text-neutral-500">{r.nNodos} nodos · {new Date(r.actualizadoEn).toLocaleDateString("es-CO")}</p>
                </a>
                <button onClick={() => eliminar(r)} title="Enviar a la papelera"
                  className="ml-3 text-neutral-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400">🗑</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Smoke** — `pnpm dev`, crear un árbol desde la home, verlo listado, eliminarlo. `pnpm lint` limpio.
- [ ] **Step 5: Commit** `feat: home con lista por materia, alta y papelera`

---

### Task 10: Hook del editor (estado + autosave)

**Files:** Create: `src/components/editor/use-arbol-editor.ts`

Estado central del editor. Sin tests unitarios (es pegamento de React); la lógica que usa ya está testeada en el modelo.

- [ ] **Step 1: Implementación**

```ts
"use client";
// use-arbol-editor.ts — Estado del editor: árbol en memoria, mutaciones del
// modelo y autosave con debounce. El humano edita; aquí no hay IA.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Arbol } from "@/lib/arbol/types";
import * as modelo from "@/lib/arbol/modelo";

export type EstadoGuardado = "guardado" | "guardando" | "pendiente" | "error";

export function useArbolEditor(materia: string, tema: string) {
  const [arbol, setArbol] = useState<Arbol | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardado, setGuardado] = useState<EstadoGuardado>("guardado");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeraCarga = useRef(true);

  useEffect(() => {
    fetch(`/api/arboles/${materia}/${tema}`)
      .then(async res => (res.ok ? setArbol(await res.json()) : setNoEncontrado(true)))
      .catch(() => setNoEncontrado(true));
  }, [materia, tema]);

  // Autosave: 800 ms tras el último cambio. Todo el árbol por PUT (simple y robusto).
  useEffect(() => {
    if (!arbol) return;
    if (primeraCarga.current) { primeraCarga.current = false; return; }
    setGuardado("pendiente");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setGuardado("guardando");
      try {
        const res = await fetch(`/api/arboles/${materia}/${tema}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(arbol),
        });
        setGuardado(res.ok ? "guardado" : "error");
      } catch { setGuardado("error"); }
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [arbol, materia, tema]);

  // Mutaciones: envuelven el modelo puro y devuelven datos útiles para la UI.
  const mutar = useCallback((fn: (a: Arbol) => Arbol) => setArbol(a => (a ? fn(a) : a)), []);

  const agregarHijo = useCallback((padreId: string): string | null => {
    let nuevoId: string | null = null;
    setArbol(a => {
      if (!a) return a;
      const r = modelo.agregarHijo(a, padreId);
      nuevoId = r.nodo.id;
      return r.arbol;
    });
    return nuevoId;
  }, []);

  const agregarHermano = useCallback((nodoId: string): string | null => {
    let nuevoId: string | null = null;
    setArbol(a => {
      if (!a) return a;
      const r = modelo.agregarHermano(a, nodoId);
      if (!r) return a;
      nuevoId = r.nodo.id;
      return r.arbol;
    });
    return nuevoId;
  }, []);

  return {
    arbol, noEncontrado, guardado,
    agregarHijo, agregarHermano,
    editarNodo: (id: string, c: modelo.CambiosNodo) => mutar(a => modelo.editarNodo(a, id, c)),
    eliminarNodo: (id: string) => mutar(a => modelo.eliminarNodo(a, id)),
    conectar: (de: string, hasta: string) => mutar(a => modelo.conectar(a, de, hasta)),
    desconectar: (relId: string) => mutar(a => modelo.desconectar(a, relId)),
    reordenar: () => mutar(a => ({ ...a, nodos: a.nodos.map(n => ({ ...n, posicion: null })) })),
  };
}
```

Nota: `agregarHijo`/`agregarHermano` devuelven el id capturado de forma síncrona porque `setArbol` con updater corre en el mismo render — patrón suficiente aquí (React 19, sin concurrencia en este flujo).

- [ ] **Step 2: typecheck** `pnpm tsc --noEmit` → sin errores.  ·  **Step 3: Commit** `feat: hook del editor con autosave debounced`

---

### Task 11: Canvas del editor (React Flow) + nodo custom

**Files:** Create: `src/app/arbol/[materia]/[tema]/page.tsx`, `src/components/editor/editor-arbol.tsx`, `src/components/editor/nodo-idea.tsx`

- [ ] **Step 1: Página (server component)**

```tsx
// src/app/arbol/[materia]/[tema]/page.tsx
import { EditorArbol } from "@/components/editor/editor-arbol";

export default async function PaginaArbol({ params }: { params: Promise<{ materia: string; tema: string }> }) {
  const { materia, tema } = await params;
  return <EditorArbol materia={materia} tema={tema} />;
}
```

- [ ] **Step 2: Nodo custom**

```tsx
"use client";
// nodo-idea.tsx — El nodo del mindmap: edición inline (doble click),
// borde según estado, color de la paleta y chips de etiquetas.
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { DatosNodoIdea } from "@/lib/arbol/a-flow";

export type NodoIdeaFlow = Node<DatosNodoIdea & {
  editando: boolean;
  resaltado: boolean;
  onTexto: (id: string, texto: string) => void;
  onEditar: (id: string | null) => void;
}, "idea">;

const BORDE_ESTADO = {
  borrador: "border-neutral-600",
  verificado: "border-emerald-500",
  dudoso: "border-amber-500",
} as const;

export function NodoIdea({ id, data, selected }: NodeProps<NodoIdeaFlow>) {
  const { nodo, editando, resaltado } = data;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editando) { input.current?.focus(); input.current?.select(); } }, [editando]);

  return (
    <div
      onDoubleClick={() => data.onEditar(id)}
      style={nodo.color ? { backgroundColor: `${nodo.color}22`, borderColor: nodo.color } : undefined}
      className={`rounded-lg border-2 bg-neutral-900 px-3 py-2 shadow-md transition-shadow
        ${BORDE_ESTADO[nodo.estado]} ${selected ? "ring-2 ring-sky-400" : ""} ${resaltado ? "ring-2 ring-yellow-300" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-neutral-500" />
      {editando ? (
        <input
          ref={input}
          defaultValue={nodo.texto}
          onBlur={e => { data.onTexto(id, e.target.value); data.onEditar(null); }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
            e.stopPropagation(); // que Tab/Enter del canvas no creen nodos mientras escribo
          }}
          className="nodrag w-40 bg-transparent text-sm text-neutral-100 outline-none"
        />
      ) : (
        <p className="max-w-56 truncate text-sm text-neutral-100">
          {nodo.estado === "verificado" && "✅ "}{nodo.estado === "dudoso" && "⚠️ "}
          {nodo.texto || <span className="text-neutral-500">(doble click para escribir)</span>}
        </p>
      )}
      {nodo.etiquetas.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {nodo.etiquetas.map(t => (
            <span key={t} className="rounded bg-neutral-800 px-1.5 text-[10px] text-neutral-400">{t}</span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-neutral-500" />
    </div>
  );
}
```

- [ ] **Step 3: Orquestador del canvas**

```tsx
"use client";
// editor-arbol.tsx — El lienzo Miro-like: pan/zoom, minimapa, teclado
// (Tab hijo · Enter hermano · Supr borrar · F2/doble-click editar),
// drag de posiciones y conexiones cruzadas arrastrando entre handles.
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  type Connection, type Edge, type Node, type NodeChange, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { aFlow } from "@/lib/arbol/a-flow";
import { raizDe } from "@/lib/arbol/modelo";
import { useArbolEditor } from "./use-arbol-editor";
import { NodoIdea } from "./nodo-idea";
import { PanelNodo } from "./panel-nodo";
import { BarraSuperior } from "./barra-superior";

const tiposDeNodo = { idea: NodoIdea };

function Lienzo({ materia, tema }: { materia: string; tema: string }) {
  const ed = useArbolEditor(materia, tema);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // Posiciones "en vivo" durante el drag (antes de commitear al árbol)
  const [posDrag, setPosDrag] = useState<Record<string, { x: number; y: number }>>({});
  const flow = useReactFlow();
  const contenedor = useRef<HTMLDivElement>(null);

  const onTexto = useCallback((id: string, texto: string) => ed.editarNodo(id, { texto }), [ed]);
  const onEditar = useCallback((id: string | null) => setEditando(id), []);

  const { nodes, edges } = useMemo(() => {
    if (!ed.arbol) return { nodes: [] as Node[], edges: [] as Edge[] };
    const q = busqueda.trim().toLowerCase();
    const proy = aFlow(ed.arbol);
    return {
      edges: proy.edges,
      nodes: proy.nodes.map(n => ({
        ...n,
        position: posDrag[n.id] ?? n.position,
        selected: n.id === seleccion,
        data: {
          ...n.data,
          editando: n.id === editando,
          resaltado: q.length > 1 && n.data.nodo.texto.toLowerCase().includes(q),
          onTexto, onEditar,
        },
      })),
    };
  }, [ed.arbol, seleccion, editando, busqueda, posDrag, onTexto, onEditar]);

  const onNodesChange = useCallback((cambios: NodeChange[]) => {
    for (const c of cambios) {
      if (c.type === "position" && c.position) {
        if (c.dragging) setPosDrag(p => ({ ...p, [c.id]: c.position! }));
        else {
          ed.editarNodo(c.id, { posicion: c.position });
          setPosDrag(p => { const { [c.id]: _omitida, ...resto } = p; return resto; });
        }
      }
      if (c.type === "select") setSeleccion(s => (c.selected ? c.id : s === c.id ? null : s));
    }
  }, [ed]);

  const crearHijo = useCallback((padreId: string) => {
    const id = ed.agregarHijo(padreId);
    if (id) { setSeleccion(id); setEditando(id); }
  }, [ed]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return; // escribir nunca dispara atajos
    if (!ed.arbol) return;
    const sel = seleccion ?? raizDe(ed.arbol).id;
    if (e.key === "Tab") { e.preventDefault(); crearHijo(sel); }
    if (e.key === "Enter") {
      e.preventDefault();
      const id = ed.agregarHermano(sel);
      if (id) { setSeleccion(id); setEditando(id); }
    }
    if (e.key === "F2") { e.preventDefault(); setEditando(sel); }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (seleccion) { ed.eliminarNodo(seleccion); setSeleccion(null); }
    }
  }, [ed, seleccion, crearHijo]);

  const irAlPrimero = useCallback(() => {
    const q = busqueda.trim().toLowerCase();
    const n = ed.arbol?.nodos.find(x => x.texto.toLowerCase().includes(q));
    if (!n) return;
    const enCanvas = nodes.find(x => x.id === n.id);
    if (enCanvas) flow.setCenter(enCanvas.position.x, enCanvas.position.y, { zoom: 1.2, duration: 400 });
  }, [busqueda, ed.arbol, nodes, flow]);

  if (ed.noEncontrado) {
    return (
      <main className="grid h-dvh place-items-center text-neutral-400">
        <p>Este árbol no existe. <a href="/" className="text-emerald-400 underline">Volver al inicio</a></p>
      </main>
    );
  }
  if (!ed.arbol) return <main className="grid h-dvh place-items-center text-neutral-500">Cargando árbol…</main>;

  const nodoSel = seleccion ? ed.arbol.nodos.find(n => n.id === seleccion) ?? null : null;

  return (
    <div ref={contenedor} tabIndex={0} onKeyDown={onKeyDown} className="flex h-dvh flex-col outline-none">
      <BarraSuperior
        arbol={ed.arbol} guardado={ed.guardado} busqueda={busqueda}
        onBusqueda={setBusqueda} onBuscar={irAlPrimero} onReordenar={ed.reordenar}
      />
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={tiposDeNodo}
          onNodesChange={onNodesChange}
          onConnect={(c: Connection) => { if (c.source && c.target) ed.conectar(c.source, c.target); }}
          onEdgeDoubleClick={(_e, edge) => { if (edge.id.startsWith("r-")) ed.desconectar(edge.id.slice(2)); }}
          onDoubleClick={() => { if (ed.arbol) crearHijo(seleccion ?? raizDe(ed.arbol).id); }}
          onPaneClick={() => { setSeleccion(null); setEditando(null); }}
          fitView proOptions={{ hideAttribution: false }} deleteKeyCode={null}
          className="bg-neutral-950"
        >
          <Background gap={24} color="#262626" />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable className="!bg-neutral-900" />
        </ReactFlow>
        {nodoSel && (
          <PanelNodo
            nodo={nodoSel}
            onCambios={c => ed.editarNodo(nodoSel.id, c)}
            onEliminar={() => { ed.eliminarNodo(nodoSel.id); setSeleccion(null); }}
            onCerrar={() => setSeleccion(null)}
          />
        )}
      </div>
    </div>
  );
}

export function EditorArbol(props: { materia: string; tema: string }) {
  return (
    <ReactFlowProvider>
      <Lienzo {...props} />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 4: typecheck + smoke** — `pnpm tsc --noEmit`; con `pnpm dev`: crear árbol, Tab crea hijo en edición, Enter hermano, doble click edita, drag mueve y persiste tras recargar (F5), conectar arrastrando entre handles dibuja flecha punteada, doble click sobre ella la borra, autosave marca "Guardado ✓". *(El smoke de UI lo confirma Antonio en su navegador; aquí basta con que la página cargue sin errores de consola del server y que el PUT llegue — verificable con curl GET después de editar.)*

- [ ] **Step 5: Commit** `feat: canvas del editor con teclado, drag, conexiones y autosave`

*(Nota: `BarraSuperior` y `PanelNodo` se crean en la Task 12 — para poder compilar/smokear la Task 11 antes, crearlos primero como stubs mínimos que rendericen `null`, y rellenarlos en la 12.)*

---

### Task 12: Barra superior y panel del nodo

**Files:** Create: `src/components/editor/barra-superior.tsx`, `src/components/editor/panel-nodo.tsx`

- [ ] **Step 1: Barra superior**

```tsx
"use client";
// barra-superior.tsx — título, búsqueda en canvas, Reordenar e indicador de guardado.
import type { Arbol } from "@/lib/arbol/types";
import type { EstadoGuardado } from "./use-arbol-editor";

const TEXTO_GUARDADO: Record<EstadoGuardado, [string, string]> = {
  guardado: ["Guardado ✓", "text-emerald-400"],
  guardando: ["Guardando…", "text-neutral-400"],
  pendiente: ["Cambios sin guardar", "text-amber-400"],
  error: ["⚠ Error al guardar — se reintenta al próximo cambio", "text-red-400"],
};

export function BarraSuperior(props: {
  arbol: Arbol; guardado: EstadoGuardado; busqueda: string;
  onBusqueda: (q: string) => void; onBuscar: () => void; onReordenar: () => void;
}) {
  const [texto, color] = TEXTO_GUARDADO[props.guardado];
  return (
    <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
      <a href="/" className="text-sm text-neutral-400 hover:text-neutral-100">← Inicio</a>
      <h1 className="truncate text-sm font-semibold">
        {props.arbol.titulo} <span className="font-normal text-neutral-500">· {props.arbol.materia}</span>
      </h1>
      <input
        value={props.busqueda}
        onChange={e => props.onBusqueda(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") props.onBuscar(); }}
        placeholder="Buscar en el canvas… (Enter salta)"
        className="ml-auto w-64 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
      />
      <button onClick={props.onReordenar} title="Recolocar todos los nodos con el auto-layout"
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
        ⇄ Reordenar
      </button>
      <span className={`w-44 text-right text-xs ${color}`}>{texto}</span>
    </header>
  );
}
```

- [ ] **Step 2: Panel del nodo**

```tsx
"use client";
// panel-nodo.tsx — Lo que no cabe dentro del nodo: notas, fuentes,
// estado, color y etiquetas del nodo seleccionado.
import type { CambiosNodo } from "@/lib/arbol/modelo";
import type { EstadoNodo, NodoArbol } from "@/lib/arbol/types";
import { useState } from "react";

const PALETA = ["#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];
const ESTADOS: { valor: EstadoNodo; texto: string }[] = [
  { valor: "borrador", texto: "Borrador" },
  { valor: "verificado", texto: "✅ Verificado" },
  { valor: "dudoso", texto: "⚠️ Dudoso" },
];

export function PanelNodo(props: {
  nodo: NodoArbol;
  onCambios: (c: CambiosNodo) => void;
  onEliminar: () => void;
  onCerrar: () => void;
}) {
  const { nodo } = props;
  const [fuenteNueva, setFuenteNueva] = useState("");
  const esRaiz = nodo.padreId === null;

  return (
    <aside className="absolute right-3 top-3 z-10 flex w-72 flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/95 p-4 text-sm shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="truncate font-semibold">{nodo.texto || "(sin texto)"}</h2>
        <button onClick={props.onCerrar} className="text-neutral-500 hover:text-neutral-200">✕</button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Estado (lo cambias TÚ; la IA solo lo sugerirá cuando exista F1)
        <select value={nodo.estado} onChange={e => props.onCambios({ estado: e.target.value as EstadoNodo })}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100">
          {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Notas
        <textarea value={nodo.notas} onChange={e => props.onCambios({ notas: e.target.value })} rows={4}
          placeholder="Apuntes, dudas, lo que tu cabeza necesite dejar aquí"
          className="resize-none rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-sky-500" />
      </label>

      <div className="flex flex-col gap-1 text-xs text-neutral-400">
        Fuentes
        {nodo.fuentes.map((f, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="flex-1 truncate text-neutral-300">{f}</span>
            <button onClick={() => props.onCambios({ fuentes: nodo.fuentes.filter((_x, j) => j !== i) })}
              className="text-neutral-600 hover:text-red-400">✕</button>
          </div>
        ))}
        <form className="flex gap-1" onSubmit={e => {
          e.preventDefault();
          if (!fuenteNueva.trim()) return;
          props.onCambios({ fuentes: [...nodo.fuentes, fuenteNueva.trim()] });
          setFuenteNueva("");
        }}>
          <input value={fuenteNueva} onChange={e => setFuenteNueva(e.target.value)} placeholder="URL o referencia"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100 outline-none focus:border-sky-500" />
          <button className="rounded-md border border-neutral-700 px-2 hover:bg-neutral-800">＋</button>
        </form>
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-400">
        Etiquetas (separadas por coma)
        <input
          defaultValue={nodo.etiquetas.join(", ")}
          key={nodo.id /* re-montar al cambiar de nodo */}
          onBlur={e => props.onCambios({ etiquetas: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
          placeholder="parcial, fórmula, repasar"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-sky-500" />
      </label>

      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">Color</span>
        {PALETA.map(c => (
          <button key={c} onClick={() => props.onCambios({ color: nodo.color === c ? null : c })}
            style={{ backgroundColor: c }}
            className={`h-5 w-5 rounded-full ${nodo.color === c ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"}`} />
        ))}
      </div>

      {!esRaiz && (
        <button onClick={props.onEliminar}
          className="mt-1 rounded-md border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950">
          🗑 Eliminar nodo (y sus hijos)
        </button>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: typecheck + lint** — `pnpm tsc --noEmit && pnpm lint` limpios.
- [ ] **Step 4: Commit** `feat: barra superior y panel del nodo seleccionado`

---

### Task 13: Verificación de punta a punta + README + iniciar.bat

**Files:** Create: `README.md`, `iniciar.bat` · Modify: ninguno

- [ ] **Step 1: Suite completa** — `pnpm test` → todo verde. `pnpm tsc --noEmit` → sin errores. `pnpm lint` → limpio. `pnpm build` → compila.

- [ ] **Step 2: Smoke E2E por API** (server dev corriendo):

```bash
curl -s -X POST localhost:3002/api/arboles -H 'Content-Type: application/json' -d '{"materia":"Cálculo Diferencial","tema":"Límites"}'
# editar: GET árbol → modificar texto de la raíz en jq/manual → PUT → 200
curl -s localhost:3002/api/arboles/calculo-diferencial/limites | head -c 400
ls "/c/Workspace/synapse-vault/05_Estudio/calculo-diferencial/"   # limites.md presente
git -C /c/Workspace/aulasmart/data log --oneline | head -3        # commits de autosave
```

- [ ] **Step 3: README.md** — qué es (mindmap-first, el humano piensa y la IA será empleada en F1+), cómo arrancar (`pnpm dev`, puerto 3002, doble click `iniciar.bat`), dónde viven los datos (`data/` + papelera + git), el espejo Obsidian (`05_Estudio`, `OBSIDIAN_VAULT_PATH`), atajos del editor (Tab/Enter/F2/Supr/doble click), API REST con ejemplos curl, y el roadmap F1–F5 apuntando al spec.

- [ ] **Step 4: iniciar.bat** (patrón del Workspace: doble click, auto-install):

```bat
@echo off
title AulaSmart
cd /d "%~dp0"
where pnpm >nul 2>nul || (echo Falta pnpm & pause & exit /b 1)
if not exist node_modules\.pnpm (set CI=true& pnpm install)
start "" http://localhost:3002
pnpm dev
```

- [ ] **Step 5: Commit final** `docs: README de la refundación + iniciar.bat` — y push si existe remote (crearlo queda para cuando Antonio vuelva: repo nuevo `aulasmart` requiere su cuenta GitHub).

---

## Self-review del plan (hecho al escribirlo)

1. **Cobertura del spec F0:** editor Miro-like (T8, T11, T12) ✓ · crear sin fricción Tab/Enter/doble-click (T11) ✓ · colores/etiquetas/búsqueda (T11–T12) ✓ · auto-layout que respeta posiciones manuales (T8) ✓ · persistencia atómica JSON+git+papelera (T4) ✓ · espejo Obsidian `05_Estudio` con frontmatter (T5–T6) ✓ · API REST como única puerta de la UI (T7, T9, T10) ✓ · funciona sin claves (no hay IA en F0) ✓ · puerto 3002 (T1) ✓. Los endpoints de nodos/IA/generadores del spec pertenecen a F1+ (plan futuro).
2. **Placeholders:** ninguno — todo código completo.
3. **Consistencia de tipos:** `DatosNodoIdea` (T8) la consumen T11; `CambiosNodo` (T3) lo consumen T10/T12; `EstadoGuardado` (T10) lo consume T12; firmas revisadas.
4. **Riesgo conocido:** `onDoubleClick` del wrapper de ReactFlow también dispara al hacer doble click sobre un nodo (el nodo hace `stopPropagation` implícito vía su propio `onDoubleClick`? NO — hay que añadir `e.stopPropagation()` en el `onDoubleClick` del nodo si se observa doble creación). Verificarlo en el smoke de T11 y corregir si aplica.
