# Agent Tracking (nombre provisional)

Observa en tiempo real qué construyen los agentes LLM en tu proyecto: requerimientos → features →
archivos → funciones, con su Definition of Done, tests, PRs y pipelines. Desktop (Tauri) y web.

## Estructura

| Ruta | Qué es |
|---|---|
| `packages/core` | Tipos de dominio, cálculo de % de avance, generador de `CONTEXT.md` |
| `packages/db` | Esquema Drizzle + SQLite (`bun:sqlite`), migraciones embebidas |
| `packages/skills` | Descubre skills instaladas (usuario, repo, plugins) y del catálogo; plantilla para crear nuevas |
| `packages/tracking` | Servicio compartido por la API y el MCP: escribe en la base, en el repo y emite eventos |
| `packages/mcp` | Servidor MCP (stdio y Streamable HTTP en `/mcp`) |
| `packages/git` | Inspecciona repos locales, clona desde GitHub, ramas, checkout, log, diffs y watcher de archivos (git sin shell) |
| `packages/analyzer` | Análisis con tree-sitter (WASM): símbolos y tests por archivo, incremental por hash — ver [su README](packages/analyzer/README.md) |
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

## Archivo de proyecto compartido

Cada proyecto con repositorio local escribe `.agent-tracking/project.json` (fuente de verdad) y
`.agent-tracking/CONTEXT.md` (contexto para agentes) dentro del repo, en cada cambio. Haz commit de
ambos: quien clone el repo puede elegir "Repositorio local" o "Clonar de GitHub" en Agent Tracking e
importar el mismo proyecto con sus ids, avance y DoD. Después de un `git pull`, el botón "Actualizar
desde el repo" vuelve a leer el archivo.

## Conectar agentes (MCP)

Con el servidor corriendo (`bun run start` o la app de escritorio), cada llamada del agente aparece en
vivo en las pestañas Trazabilidad, Actividad y Tests del proyecto.

Claude Code, desde la raíz del repo del proyecto (el proyecto se identifica por la ruta):

```bash
claude mcp add agent-tracking -- bun /ruta/a/agent-tracking/packages/mcp/src/stdio.ts
```

O por HTTP, sin proceso intermedio:

```bash
claude mcp add --transport http agent-tracking "http://127.0.0.1:4317/mcp?project=$(pwd)"
```

Otros agentes (Cursor, Codex, etc.) usan la misma configuración: comando
`bun packages/mcp/src/stdio.ts` con argumentos opcionales `--project <id|ruta>` (por defecto el cwd),
`--agent <nombre>` y `--url <servidor>`; o la URL `http://127.0.0.1:4317/mcp?project=<id|ruta>&agent=<nombre>`.
Si el servidor no está corriendo, `--db <archivo>` escribe directo en la base.

Herramientas: `get_project_context`, `get_project_skills`, `list_requirements`, `get_requirement`,
`start_feature`, `complete_feature`, `report_file`, `report_symbol`, `report_test`, `mark_dod_item`,
`suggest_test_idea`.
## Análisis del repositorio

Para proyectos con repositorio local (`packages/server/src/repo-routes.ts`):

| Endpoint | Qué devuelve |
|---|---|
| `GET /api/projects/:id/repo/branches` | Ramas locales y rama actual |
| `POST /api/projects/:id/repo/checkout` `{ branch }` | Cambia de rama; 409 si hay cambios sin commit |
| `GET /api/projects/:id/repo/commits?ref&limit&skip&path` | Log con autor, fecha y archivos cambiados |
| `GET /api/projects/:id/repo/changes?from&to` | Archivos cambiados entre refs, o en el árbol de trabajo sin `from` |
| `GET /api/projects/:id/repo/analysis/file?path=` | Símbolos y tests de un archivo |
| `GET /api/projects/:id/repo/analysis` | Repo completo (incremental, caché por hash de contenido) |

Las heurísticas de detección y clasificación de tests están en [packages/analyzer/README.md](packages/analyzer/README.md).

## Verificación

```bash
bun test                  # core, skills y API
bun run typecheck
bun run check:web
```

Tras cambiar `packages/db/src/schema.ts`: `cd packages/db && bun run generate` (genera la migración y la embebe).

## Hoja de ruta

1. Fundaciones ✅
2. Servidor MCP + tiempo real ✅
3. Análisis del repo (git, tree-sitter, tests)
4. GitHub (PRs, Actions)
5. Asistente LLM (stack, DoD, ideas de tests)
6. Gestión de cambios y detección de conflictos
7. Web multiusuario
8. Colaboración
