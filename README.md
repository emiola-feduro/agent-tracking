# Agent Tracking (nombre provisional)

Observa en tiempo real qué construyen los agentes LLM en tu proyecto: requerimientos → features →
archivos → funciones, con su Definition of Done, tests, PRs y pipelines. Desktop (Tauri) y web.

## Estructura

| Ruta | Qué es |
|---|---|
| `packages/core` | Tipos de dominio, cálculo de % de avance, generador de `CONTEXT.md` |
| `packages/db` | Esquema Drizzle + SQLite (`bun:sqlite`), migraciones embebidas |
| `packages/skills` | Descubre skills instaladas (usuario, repo, plugins) y del catálogo; plantilla para crear nuevas |
| `packages/git` | Inspecciona repos locales y clona desde GitHub (git sin shell) |
| `packages/assistant` | Asistente con la API de Claude: stack, criterios de DoD y skills, con salidas validadas con zod |
| `packages/server` | API Hono + WebSocket de eventos (`/ws`); importación de repos; sirve la SPA compilada |
| `apps/web` | UI React 19 + TanStack Router/Query + Tailwind 4 + Zustand (SPA con Vite) |
| `apps/desktop` | Tauri 2; ejecuta el servidor como sidecar compilado con `bun build --compile` |

## Desarrollo

```bash
bun install
bun run dev:server        # API en http://127.0.0.1:4317
bun run dev:web           # UI con proxy a la API (vite)
```

Producción web: `bun run build:web && bun run start` (todo en el puerto 4317).

Desktop: requiere las dependencias de sistema de Tauri (en Linux `webkit2gtk-4.1` y `libsoup-3.0`).

```bash
cd apps/desktop && bun run dev
```

## Asistente con Claude

Opcional. Sin clave todo funciona con los valores deterministas y la UI oculta las acciones de IA.

```bash
export ANTHROPIC_API_KEY=...   # en el entorno del proceso del servidor, nunca en archivos del repo
bun run start
```

| Variable | Por defecto | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | sin definir | Activa el asistente |
| `AGENT_TRACKING_ASSISTANT_MODEL` | `claude-sonnet-5-5` | Criterios de DoD y selección de skills |
| `AGENT_TRACKING_ASSISTANT_HEAVY_MODEL` | `claude-opus-5-5` | Recomendación de stack |

Endpoints: `GET /api/assistant` (estado), `POST /api/assistant/stack`, `POST /api/assistant/dod`,
`POST /api/assistant/skills` y `POST /api/projects/:id/requirements/:reqId/dod/suggest`. Sin clave
responden 503. La recomendación de stack pasa por las reglas de `packages/core` y, si la respuesta no
es válida, devuelve `recommendStack` con `source: "default"`.

## Archivo de proyecto compartido

Cada proyecto con repositorio local escribe `.agent-tracking/project.json` (fuente de verdad) y
`.agent-tracking/CONTEXT.md` (contexto para agentes) dentro del repo, en cada cambio. Haz commit de
ambos: quien clone el repo puede elegir "Repositorio local" o "Clonar de GitHub" en Agent Tracking e
importar el mismo proyecto con sus ids, avance y DoD. Después de un `git pull`, el botón "Actualizar
desde el repo" vuelve a leer el archivo.

## Verificación

```bash
bun test                  # core, skills y API
bun run typecheck
bun run check:web
```

Tras cambiar `packages/db/src/schema.ts`: `cd packages/db && bun run generate` (genera la migración y la embebe).

## Hoja de ruta

1. Fundaciones ✅
2. Servidor MCP + tiempo real
3. Análisis del repo (git, tree-sitter, tests)
4. GitHub (PRs, Actions)
5. Asistente LLM (stack, DoD, skills) ✅
6. Gestión de cambios y detección de conflictos
7. Web multiusuario
8. Colaboración
