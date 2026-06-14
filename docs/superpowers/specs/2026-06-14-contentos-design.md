# ContentOS — Spec de Diseño

**Fecha:** 2026-06-14  
**Estado:** Aprobado  
**Repo:** nuevo repo independiente (`contentos`)  
**Autor:** Antonio Pérez + Claude Sonnet

---

## 1. Visión

ContentOS es el sistema operativo personal para crear contenido de calidad.

**El video es el kernel.** Igual que un sistema operativo tiene un núcleo que gestiona todos los recursos del sistema, en ContentOS el video analizado es el núcleo desde el que se construye todo lo demás: guiones, imágenes, videos nuevos, calendarios, estrategias, voces. El usuario no consume el contenido — lo descompila, lo entiende y lo reconstruye.

No es "una app que resume videos" — es un sistema de inteligencia de contenido que, con el tiempo, construye la fórmula personal de viralidad del usuario: aprende qué funciona en su nicho, con su audiencia, en su estilo.

**Propuesta de valor única:**
- Análisis de profundidad real con Claude Sonnet extended thinking (las alternativas usan GPT-3.5)
- Único en el mercado que conecta análisis → generación (Higgsfield, Runway, Kling, ElevenLabs, Flux)
- Inteligencia acumulativa: tras 20+ videos, detecta patrones y construye la fórmula de viralidad del usuario
- +1000 plataformas soportadas vía yt-dlp (TikTok, YouTube, Instagram, X, Twitch, Reddit, Vimeo…)
- Coste ~$5–15/mes vs $49–99/mes de los competidores (Castmagic, OpusClip, Vidyo.ai)

---

## 2. Usuarios y contexto

- **Usuario inicial:** uso personal, sin login, un solo workspace
- **Escalado futuro:** multi-usuario con NextAuth sin reescribir arquitectura
- **No hay auth en v1** — acceso directo a la app

---

## 3. Plataformas soportadas

| Plataforma | Método | Fiabilidad |
|---|---|---|
| YouTube | yt-dlp + captions API nativa | ✅ Excelente |
| X / Twitter | yt-dlp | ✅ Muy buena |
| Reddit | yt-dlp | ✅ Muy buena |
| Twitch clips | yt-dlp | ✅ Muy buena |
| Vimeo | yt-dlp | ✅ Muy buena |
| TikTok | yt-dlp (primario) + Apify (fallback) | ⚠️ Buena con fallback |
| Instagram Reels | yt-dlp (primario) + RapidAPI (fallback) | ⚠️ Buena con fallback |
| Facebook | yt-dlp (videos públicos) | ⚠️ Limitada |

**Estrategia por capas:** yt-dlp primero (gratis), si falla → Apify/RapidAPI como fallback opcional configurable por el usuario.

---

## 4. Pipeline técnico completo

```
URL input
  → Detección de plataforma
  → yt-dlp download (o captions API si es YT)
  → FFmpeg: extrae audio MP3 + frames clave (detección de escenas)
  → Groq Whisper: transcripción completa con timestamps
  → Speaker diarization: quién habla cuándo
  → Claude Sonnet 4.6 (extended thinking):
      - recibe transcript + frames clave como imágenes
      - genera los 16 análisis en un solo prompt
      - streaming SSE → UI en tiempo real
  → JSON estructurado guardado en /data/<slug-url>.json
  → SQLite (Drizzle): índice para búsqueda semántica y patrones
  → /tmp limpiado al terminar (video/audio descargados)
```

**Cola de trabajos:** BullMQ + Redis para procesar múltiples URLs en paralelo. Progreso en tiempo real vía SSE.

---

## 5. Los 16 análisis (módulo A)

Todos generados por Claude Sonnet en un solo prompt con extended thinking:

| # | Análisis | Descripción |
|---|---|---|
| A | Transcripción completa | Texto con timestamps por momento clave |
| B | Resumen ejecutivo | 3–5 puntos clave listos para copiar |
| C | Hooks & momentos virales | Instantes más impactantes con timestamp exacto |
| D | Ideas de contenido derivado | Posts, reels, threads, videos nuevos basados en este |
| E | Análisis de estrategia | Por qué funciona: estructura, emoción, CTA, audiencia |
| F | Contexto para generación | Prompts para Higgsfield/Runway/Kling/Flux por escena |
| G | Estructura del video | Timestamps: intro / desarrollo / giro / CTA / outro |
| H | Guion listo para grabar | Guion nuevo adaptado a la voz/nicho del usuario |
| I | Estilo visual | Paleta, tipografía, ritmo de cortes, transiciones, overlays |
| J | Música & sonido | Identifica canción, ritmo emocional, sugerencias similares |
| K | Arco emocional | Mapa de emociones: dónde engancha, tensión, conversión |
| L | SEO & hashtags | Keywords, hashtags usados vs recomendados, trending |
| M | Perfil de audiencia | Edad, intereses, nivel, plataforma principal |
| N | Plan de repurposing | Video → thread, carrusel, newsletter, short, podcast, blog |
| O | Prompts de imagen | Midjourney / DALL·E / Flux para thumbnails y assets |
| P | Prompts de video | Higgsfield / Runway / Kling por escena con movimiento cámara |

**Extensible:** nuevos módulos de análisis se añaden como funciones separadas sin tocar el pipeline.

---

## 6. Capacidades diferenciadoras (módulo B)

### B1. Chat con el video
Una vez analizado, el usuario puede hacer preguntas en lenguaje natural:
- "¿En qué minuto habla de pricing?"
- "Dame un argumento en contra de lo que dice"
- "¿Cómo adaptaría esto para LinkedIn?"

Claude responde usando el análisis guardado como contexto. Sin re-procesar el video.

### B2. Análisis comparativo multi-video
El usuario pega 2–10 URLs. La app las analiza en paralelo y genera un informe comparativo:
- Qué tienen en común los que más funcionan
- Qué patrones se repiten
- Qué falta en los que menos rinden

### B3. Perfil de estilo propio
El usuario indica cuál es su canal. La app analiza sus videos propios. A partir de ahí, toda idea generada se adapta a su voz, ritmo de edición y audiencia — no genérico.

### B4. Inteligencia de nicho acumulativa
Tras analizar 20+ videos:
- Detecta patrones: "El 78% de virales en tu nicho empiezan con pregunta en 3 seg"
- Construye la fórmula personal de viralidad
- Cada nuevo análisis se enriquece con el contexto acumulado

### B5. Bulk analysis
Hasta 20 URLs a la vez. Cola BullMQ procesa en paralelo. Dashboard de progreso en tiempo real.

### B6. Calendario de contenido 30 días
De las ideas de repurposing de todos los análisis, genera un calendario publicable con qué publicar, en qué plataforma, en qué formato y cuándo.

---

## 7. Hub de generación (módulo C)

Desde cualquier análisis guardado, el usuario puede lanzar generación directa.

### Estrategia de hubs (hallazgo clave de investigación)

En lugar de integrar 8+ APIs de video por separado, **Higgsfield y Luma AI son hubs agregadores**:
- **Higgsfield** → da acceso a Veo 3.1 + Kling 3.0 + Seedance 2.0 + Soul 2.0 (propio)
- **Luma AI** → da acceso a Ray-2 + Kling 3.0 + Seedance + Veo 3.1 + ElevenLabs audio
- **fal.ai** → da acceso a Flux + Pika + Stable Diffusion + docenas de modelos de imagen

Con solo 3 integraciones principales se cubre el 90% del ecosistema de generación.

### Orden de integración y prioridades

| # | Herramienta | Tipo | Prioridad | Pricing | Motivo |
|---|---|---|---|---|---|
| 1 | **fal.ai** | Hub imágenes + Pika | ALTA — Fase 3 | $0.025–0.05/img | Un endpoint, cubre Flux + Pika + SD + docenas más |
| 2 | **Higgsfield AI** | Hub video principal | ALTA — Fase 3 | Pay-per-use (créditos) | SDK oficial JS, accede a Veo 3.1 + Kling 3.0 + Seedance |
| 3 | **ElevenLabs** | Clone de voz + TTS | ALTA — Fase 3 | Desde $11/mes | SDK maduro, clone de voz es diferenciador clave |
| 4 | **Ideogram** | Imágenes con texto | ALTA — Fase 3 | $0.03/img | El mejor para thumbnails con texto (logos, banners) |
| 5 | **HeyGen** | Avatar / talking head | ALTA — Fase 4 | $1–4/min (pay-as-you-go) | Sin compromiso mensual, ideal para videos con presentador |
| 6 | **Luma AI** | Segundo hub video | MEDIA — Fase 4 | Ray-2: ~$0.08/seg | Complementa Higgsfield, accede a modelos distintos |
| 7 | **D-ID** | Talking head alternativo | MEDIA — Fase 4 | ~$5.90/min | Más barato que HeyGen para casos simples |
| 8 | **DALL·E 3** | Imágenes IA | MEDIA — Fase 4 | ~$0.04–0.12/img | Fácil si ya hay API key de OpenAI (reutiliza SDK) |
| 9 | **Udio** | Música IA | MEDIA — Fase 5 | Free + $10/mes | API directa disponible (mejor que Suno) |
| 10 | **Murf AI** | TTS alternativo | BAJA — Fase 5 | Desde $19/mes | Solo si ElevenLabs no cubre el caso |

### Descartadas (con justificación)

| Herramienta | Motivo de descarte |
|---|---|
| Runway ML | Enterprise-only desde enero 2026. Volver a evaluar si abren acceso |
| Midjourney | Sin API oficial. Proxies no oficiales violan ToS — riesgo de ban |
| Suno | Sin API oficial. Proxies no oficiales, riesgo ToS. Sustituido por Udio |
| Haiper | Pivotó a B2B enterprise en 2025, sin acceso self-serve |
| Kling AI (directo) | Enterprise-only en API oficial. Accesible vía Higgsfield/Luma — no integrar directo |

**Diseño de integración:** cada herramienta es un módulo independiente en `/lib/generators/`. La app funciona aunque no esté configurada ninguna. El usuario activa las que tiene API key en `.env`.

---

## 8. Integraciones de distribución (módulo D)

| Integración | Función | Prioridad | Nota |
|---|---|---|---|
| **Notion** | Export análisis como página | ALTA — Fase 4 | API oficial madura |
| **Obsidian** | Export a bóveda (markdown) | ALTA — Fase 4 | Export local, sin API |
| **PDF export** | Reportes de análisis | ALTA — Fase 4 | Sin dependencias externas |
| **Telegram Bot** | Notificación al terminar análisis | ALTA — Fase 3 | API simple, muy útil para jobs largos |
| **Make.com / Zapier** | Webhooks para automatizar flujos | MEDIA — Fase 4 | Webhook saliente desde ContentOS |
| **Google Sheets** | Export de datos | MEDIA — Fase 4 | Para análisis de patrones |
| **Later** | Scheduling posts | MEDIA — Fase 5 | API REST disponible |
| **Buffer** | Scheduling posts | BAJA — Fase 5 | En transición a GraphQL, API nueva sin OAuth de terceros aún |
| **Discord** | Notificación al terminar | BAJA — Fase 5 | Webhook simple |

---

## 9. Arquitectura técnica

### Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework | Next.js 15 (App Router) | Mismo ecosistema que el usuario ya conoce |
| Estilos | Tailwind CSS + shadcn/ui | Velocidad de desarrollo |
| Descarga | yt-dlp (sistema) | +1000 sitios, open source |
| Procesamiento | FFmpeg (sistema) | Estándar industria para audio/video |
| Transcripción | Groq Whisper API | Gratis, velocidad x10 sobre OpenAI Whisper |
| Análisis IA | Claude Sonnet 4.6 (extended thinking) | Calidad superior, AI SDK v6 con streaming |
| Análisis visual | Claude Sonnet Vision (frames) | Mismo modelo, sin coste adicional |
| Cola | BullMQ + Redis (local) | Jobs en background, retry automático |
| Storage | JSON en /data/ (análisis) | Simple, portátil, git-friendly |
| Base de datos | SQLite + Drizzle ORM | Búsqueda semántica, patrones de nicho |
| API types | Zod | Validación en todos los endpoints |
| Tests | Vitest | Consistente con ecosistema |

### Estructura de carpetas

```
contentos/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Dashboard principal
│   │   ├── analyze/page.tsx    # Vista de análisis
│   │   ├── library/page.tsx    # Biblioteca de análisis
│   │   ├── compare/page.tsx    # Comparativo multi-video
│   │   ├── generate/page.tsx   # Hub de generación
│   │   └── api/
│   │       ├── analyze/route.ts        # POST: inicia análisis
│   │       ├── analyze/[id]/route.ts   # GET SSE: progreso en tiempo real
│   │       ├── chat/route.ts           # POST: chat con video
│   │       ├── compare/route.ts        # POST: comparativo multi-video
│   │       ├── generate/video/route.ts # POST: lanza generación video
│   │       ├── generate/image/route.ts # POST: lanza generación imagen
│   │       └── library/route.ts        # GET: lista análisis guardados
│   ├── lib/
│   │   ├── pipeline/           # Orquestador del pipeline
│   │   │   ├── download.ts     # yt-dlp wrapper
│   │   │   ├── extract.ts      # FFmpeg: audio + frames
│   │   │   ├── transcribe.ts   # Groq Whisper
│   │   │   └── analyze.ts      # Claude Sonnet (16 análisis)
│   │   ├── queue/              # BullMQ workers
│   │   ├── storage/            # JSON + SQLite
│   │   ├── generators/         # Integraciones de generación
│   │   │   ├── higgsfield.ts
│   │   │   ├── runway.ts
│   │   │   ├── kling.ts
│   │   │   ├── elevenlabs.ts
│   │   │   └── flux.ts
│   │   ├── distributors/       # Integraciones de distribución
│   │   │   ├── buffer.ts
│   │   │   ├── notion.ts
│   │   │   └── obsidian.ts
│   │   └── intelligence/       # Módulo de patrones de nicho
│   │       ├── patterns.ts
│   │       └── profile.ts
│   └── components/
│       ├── analyzer/           # UI del análisis
│       ├── library/            # Biblioteca
│       ├── generator/          # Hub de generación
│       └── chat/               # Chat con video
├── data/                       # JSONs de análisis (gitignored)
├── scripts/                    # Setup y utilidades
├── .env.example
└── package.json
```

---

## 10. Flujo de datos

```
1. Usuario pega URL en UI
2. POST /api/analyze → crea job en BullMQ → devuelve job_id
3. UI abre SSE a GET /api/analyze/[job_id] → escucha progreso
4. Worker ejecuta pipeline:
   a. download.ts: yt-dlp → /tmp/<hash>/video.mp4
   b. extract.ts: FFmpeg → audio.mp3 + frames/*.jpg
   c. transcribe.ts: Groq Whisper → transcript.json
   d. analyze.ts: Claude Sonnet → análisis completo (stream)
   e. storage.ts: guarda JSON en /data/<slug>.json
   f. db.ts: indexa en SQLite para búsqueda
   g. cleanup: elimina /tmp/<hash>/
5. SSE emite cada análisis conforme llega (streaming)
6. UI renderiza resultados en tiempo real, módulo por módulo
7. Al terminar: usuario puede lanzar generación desde cualquier análisis
```

---

## 11. Modelo de datos (JSON por análisis)

```typescript
interface Analisis {
  id: string                    // hash de la URL
  url: string
  plataforma: string
  titulo: string
  duracion: number              // segundos
  fecha_analisis: string        // ISO
  metadata: {
    autor: string
    likes?: number
    vistas?: number
    descripcion?: string
  }
  transcript: {
    texto: string
    segmentos: { inicio: number; fin: number; texto: string }[]
    idioma: string
  }
  analisis: {
    resumen: string
    hooks: Hook[]
    estructura: Segmento[]
    estrategia: string
    arco_emocional: PuntoEmocional[]
    estilo_visual: string
    musica: string
    audiencia: string
    seo: { keywords: string[]; hashtags: string[] }
    ideas_contenido: IdeaContenido[]
    repurposing: PlanRepurposing
    guion: string
    prompts_imagen: PromptGeneracion[]
    prompts_video: PromptGeneracion[]
  }
  generaciones: GeneracionGuardada[]  // historial de lo generado
  nicho_tags: string[]          // para inteligencia acumulativa
}
```

---

## 12. Manejo de errores

| Error | Estrategia |
|---|---|
| yt-dlp falla (TikTok/IG bloqueado) | Retry automático × 2, luego fallback Apify/RapidAPI |
| Groq Whisper falla | Fallback a OpenAI Whisper API |
| Claude rate limit | Retry con backoff exponencial |
| Video demasiado largo (+2h) | Chunking automático: análisis por segmentos de 30 min |
| URL inválida | Validación antes de encolar, error inmediato al usuario |
| /tmp lleno | Limpieza FIFO de jobs más antiguos |
| API de generación falla | Error no-fatal: el análisis se guarda igual, solo falla la generación |

---

## 13. Fases de desarrollo

### Fase 1 — Core (MVP funcional)
- Setup del proyecto Next.js 15
- Pipeline completo: URL → yt-dlp → FFmpeg → Groq → Claude → JSON
- 16 análisis con streaming SSE
- UI básica: input URL, progreso, resultados por tab
- Storage JSON local

### Fase 2 — Biblioteca y Chat
- Dashboard con todos los análisis guardados
- Búsqueda en la biblioteca
- Chat con video (Claude usa el análisis como contexto)
- SQLite para indexado

### Fase 3 — Hub de Generación
- Integración Higgsfield AI
- Integración Runway ML
- Integración ElevenLabs
- Integración Flux/DALL-E
- UI del hub de generación por escena

### Fase 4 — Inteligencia
- Patrones de nicho acumulativos
- Perfil de estilo propio del usuario
- Análisis comparativo multi-video
- Bulk analysis (hasta 20 URLs)
- Calendario de contenido 30 días

### Fase 5 — Distribución
- Export Notion / Obsidian
- Buffer / Later scheduling
- Notificaciones Telegram/Discord
- Auth multi-usuario (NextAuth)

---

## 14. Costes estimados (uso personal)

| Componente | Coste | Notas |
|---|---|---|
| yt-dlp | $0 | Open source |
| FFmpeg | $0 | Open source |
| Groq Whisper | $0 (tier gratis) | Límite generoso para uso personal |
| Claude Sonnet 4.6 | ~$0.05–0.20 por video | Con extended thinking, 10 min de video |
| Redis (local) | $0 | Instancia local |
| SQLite | $0 | Embebido |
| **Total por análisis** | **~$0.10–0.20** | vs $49–99/mes de competidores |

---

## 15. Principios de desarrollo

1. **Lógica pura siempre con tests** — pipeline, storage, integraciones (Vitest)
2. **Todo pasa por /api/*** — ninguna lógica de dominio en componentes
3. **Gratis-first** — Groq > Gemini > Claude (pago). Para análisis principal Claude es la excepción justificada por calidad
4. **Modular** — cada integración es opcional, la app funciona sin ninguna configurada
5. **Local-first** — datos en /data/ (JSON) y SQLite local. Sin dependencias de cloud storage
6. **Extensible** — nuevos análisis = nueva clave en el JSON. Nuevas integraciones = nuevo módulo en /generators/
