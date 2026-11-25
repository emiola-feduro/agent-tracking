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
| `packages/github` | Cliente de GitHub (Octokit) con caché por ETag: PRs, ramas remotas y GitHub Actions |
| `packages/assistant` | Asistente con Claude, OpenAI o Gemini (por API o con su CLI): stack, criterios de DoD y skills, con salidas validadas con zod |
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

## Asistente

Opcional. Sin asistente todo funciona con los valores deterministas y la UI oculta las acciones de IA.
El asistente sugiere el stack, los criterios del DoD y las skills. Al arrancar, el servidor detecta
qué proveedores puede usar y activa el primero de esta lista (Claude primero):

1. **Claude con API key** (`api`, `ANTHROPIC_API_KEY`): pago por uso en Claude Console. Es la vía
   para instalaciones que usan otras personas: cada una con su propia key.
2. **Tu Claude Code instalado** (`claude-code`): si el comando `claude` tiene una sesión iniciada
   (`claude auth status`), cada sugerencia se ejecuta con `claude -p` y la cubre tu suscripción
   Pro o Max, compartiendo su cupo de uso. Corre sin herramientas ni servidores MCP.
3. **OpenAI con API key** (`openai-api`, `OPENAI_API_KEY`): Responses API con Structured Outputs
   (`text.format` de tipo `json_schema` en modo estricto).
4. **Gemini con API key** (`gemini-api`, `GEMINI_API_KEY`): `generateContent` con
   `responseMimeType: application/json` y `responseJsonSchema`.
5. **Tu Codex CLI instalado** (`codex-cli`): si `codex login status` termina bien, cada sugerencia
   se ejecuta con `codex exec` en modo `--sandbox read-only`, `--ephemeral`, sin tu configuración
   de usuario y con `--output-schema` para la respuesta.
6. **Tu Gemini CLI instalado** (`gemini-cli`): si `gemini --version` responde, cada sugerencia se
   ejecuta en modo headless (`gemini -p --output-format json --approval-mode plan`). Este CLI no
   acepta un esquema, así que el esquema va en el prompt y la respuesta se valida aquí. Si no has
   iniciado sesión (o definido `GEMINI_API_KEY`), la primera sugerencia falla.

Los CLIs corren desde una carpeta vacía y las peticiones van de una en una. Toda respuesta se valida
con zod, venga de donde venga.

```bash
export OPENAI_API_KEY=...      # opcional; en el entorno del servidor, nunca en archivos del repo
bun run start                  # el log dice qué proveedor quedó activo y cuáles más hay
```

En la UI, **Apariencia → Asistente** muestra los proveedores disponibles y permite cambiar el activo
mientras el servidor sigue en marcha. El botón de las acciones de IA dice de quién son los tokens que
gasta. El cambio no se guarda: para fijarlo, usa `AGENT_TRACKING_ASSISTANT_PROVIDER`.

| Variable | Por defecto | Uso |
|---|---|---|
| `AGENT_TRACKING_ASSISTANT_PROVIDER` | `auto` | `auto` (el primero disponible), `api`, `claude-code`, `openai-api`, `gemini-api`, `codex-cli`, `gemini-cli` u `off` |
| `ANTHROPIC_API_KEY` | sin definir | Activa Claude por API |
| `OPENAI_API_KEY` | sin definir | Activa OpenAI por API |
| `GEMINI_API_KEY` | sin definir | Activa Gemini por API (Gemini CLI también la usa) |
| `AGENT_TRACKING_CLAUDE_BIN` | `claude` | Ruta al CLI de Claude Code |
| `AGENT_TRACKING_CODEX_BIN` | `codex` | Ruta al CLI de Codex |
| `AGENT_TRACKING_GEMINI_BIN` | `gemini` | Ruta al CLI de Gemini |
| `AGENT_TRACKING_ASSISTANT_MODEL` | `claude-sonnet-5-5` | Claude: criterios de DoD y selección de skills |
| `AGENT_TRACKING_ASSISTANT_HEAVY_MODEL` | `claude-opus-5-5` | Claude: recomendación de stack |
| `AGENT_TRACKING_OPENAI_MODEL` | `gpt-6.2-sol` | OpenAI: DoD y skills |
| `AGENT_TRACKING_OPENAI_HEAVY_MODEL` | `gpt-6.2-astra` | OpenAI: stack |
| `AGENT_TRACKING_GEMINI_MODEL` | `gemini-4-hydrogen` | Gemini API: DoD y skills |
| `AGENT_TRACKING_GEMINI_HEAVY_MODEL` | `gemini-4-carbon` | Gemini API: stack |
| `AGENT_TRACKING_CODEX_MODEL`, `AGENT_TRACKING_CODEX_HEAVY_MODEL` | el de tu configuración de Codex | Codex CLI (`--model`) |
| `AGENT_TRACKING_GEMINI_CLI_MODEL`, `AGENT_TRACKING_GEMINI_CLI_HEAVY_MODEL` | el de Gemini CLI (`auto`) | Gemini CLI (`--model`) |

Si inicias sesión en un CLI o cambias una key, reinicia el servidor para que lo detecte.

Endpoints: `GET /api/assistant` (estado y proveedor activo), `GET /api/assistant/providers` (los
disponibles), `PUT /api/assistant/provider` (`{ "provider": "openai-api" }`, cambia el activo),
`POST /api/assistant/stack`, `POST /api/assistant/dod`, `POST /api/assistant/skills` y
`POST /api/projects/:id/requirements/:reqId/dod/suggest`. Sin asistente las sugerencias responden 503.
La recomendación de stack pasa por las reglas de `packages/core` y, si la respuesta no es válida,
devuelve `recommendStack` con `source: "default"`.

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
## GitHub

El wizard puede crear un **repositorio nuevo** (carpeta vacía con `git init` en `main`) y, para
cualquier repo, una carpeta `.github` con un pipeline de CI (`workflows/ci.yml`, según el stack:
Bun, Node.js, Python, Go, Rust, Flutter, .NET o Java) y una plantilla de pull request con el
requerimiento y el checklist del Definition of Done. Los archivos que ya existen no se tocan.
Ambos se eligen en el Resumen, cuando ya se conocen el stack y los requerimientos; la plantilla
de pull request se puede editar en Markdown con vista previa.

### Tipo de proyecto y stack

En el paso Proyecto se elige el tipo: aplicación completa, sitio o app web, API o servicio, app
de escritorio, app móvil, herramienta de terminal o librería. El tipo decide qué partes del stack
aplican (una API no ofrece frameworks de interfaz, una librería no ofrece backend) y la
recomendación por defecto. Algunas tecnologías dependen de otras: Tailwind necesita un framework
web, un runtime de JavaScript necesita TypeScript o un framework de JavaScript, Vitest o un ORM
de JavaScript necesitan TypeScript o un runtime. Sin esa base aparecen deshabilitadas y se quitan
solas si se quita lo que necesitan.

### Requerimientos, imágenes y vistas

Cada requerimiento es funcional o no funcional y tiene un área (frontend, backend, datos,
infraestructura, seguridad, rendimiento, experiencia de uso o general). La pestaña Requerimientos
los agrupa por tipo y filtra por tipo, área y texto.

A un requerimiento o a un criterio del Definition of Done se le pueden adjuntar imágenes de
referencia (arrastrar, elegir o pegar con Ctrl+V; PNG, JPEG, WebP, GIF o AVIF de hasta 10 MB).
Se guardan en la base de datos y se copian a `.agent-tracking/attachments/`, y `CONTEXT.md` las
lista para que el agente las abra antes de implementar.

La pestaña Vistas es la galería de pantallas de la app: capturas subidas a mano o reportadas por
el agente con la herramienta MCP `report_screen` (una imagen guardada dentro del repositorio).

### Compartir el proyecto por git

`.agent-tracking/project.json` lleva todo lo necesario para que quien clone el repo importe el mismo
proyecto desde el wizard (Repositorio local o Clonar de GitHub): requerimientos con su DoD, features,
archivos, símbolos, tests, reglas, skills y la lista de imágenes, cuyos archivos están en
`.agent-tracking/attachments/`. Al importar se restauran las imágenes; "Actualizar desde el repo"
vuelve a leerlo después de un pull. Turnos, actividad y caché de GitHub son de cada equipo.

Las skills del proyecto muestran en su pestaña si están en este equipo:

- **Personales o creadas:** con "Incluirla en el repo" se copian a `.agent-tracking/skills/<nombre>`
  (sin archivos ocultos ni `node_modules`, hasta 60 archivos y 2 MB). En otro equipo, "Instalar desde
  el repo" las copia a `~/.claude/skills` sin reemplazar nada existente. `CONTEXT.md` apunta a esa copia,
  así que el agente puede leerla aunque no esté instalada.
- **De un plugin:** se guarda el plugin y su marketplace. "Instalar plugin" ejecuta
  `claude plugin marketplace add` (si falta el marketplace) y `claude plugin install`, previa
  confirmación. Estas no se copian al repo.
- **Del repo** (`.claude/skills`): ya viajan con git.

### Clasificar e importar requerimientos

Un requerimiento **funcional** dice qué hace el sistema y su área es la parte del sistema (frontend,
backend, datos, integraciones, infraestructura). Uno **no funcional** dice qué tan bien lo hace y su
área es un atributo de calidad (rendimiento, seguridad, usabilidad, accesibilidad, confiabilidad,
escalabilidad, mantenibilidad, compatibilidad). Si no se indican, se deducen del texto; la app avisa
cuando el texto sugiere otra clasificación.

Los requerimientos se pueden importar pegando o abriendo Markdown o JSON (en la pestaña
Requerimientos y en el wizard). En Markdown, un título por requerimiento con `[tipo, área]` opcional
al final y sus criterios del Definition of Done como lista o checklist debajo.

Un agente puede crear un proyecto completo desde un plan con las herramientas MCP `get_plan_format` y
`create_project`. Si al plan le falta algo que el wizard pide sí o sí (nombre, tipo, plataformas en
una app completa, objetivo, requerimientos), `create_project` no crea nada y devuelve las preguntas
para que el agente se las haga a la persona.

Los botones que llaman a Claude y gastan tokens tienen un brillo y una chispa sutiles.

### Convenciones de commits

En el wizard (paso Objetivo y reglas) y en la sección Reglas y convenciones se eligen las categorías de
commit que aplican (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert), si el
alcance entre paréntesis es opcional u obligatorio, el idioma y las reglas propias del equipo. Si no
se define nada, se usan Conventional Commits con ramas `tipo/tema`. Todo queda en `CONTEXT.md` para
que los agentes lo sigan.

### Crear el repositorio en GitHub

Para un repositorio local sin remoto, el Resumen del wizard (y el Resumen del proyecto) ofrece crearlo
en GitHub con la sesión de GitHub CLI (`gh`) del equipo: cuenta u organización, nombre y visibilidad
(privado por defecto). Se conecta como `origin` y se sube la rama actual; si no hay commits, se hace
uno primero.

### Ramas, worktrees y turnos del agente

- El menú de arriba del sidebar cambia la rama del checkout principal (avisa antes si git no lo
  permitiría por cambios sin commit) o pasa a mirar otro worktree: su rama, su código, su diff y lo
  último que hizo un agente ahí.
- En **Ramas y worktrees** también se borran ramas locales. No se puede borrar la rama actual, una
  abierta en un worktree ni una en la que esté trabajando un agente (un turno abierto en esa rama). Si
  la rama tiene commits que no están en `main`, se avisa cuántos se perderían antes de borrarla.
- En **Ramas en GitHub** también se borran ramas remotas, con la sesión de GitHub del servidor. Nunca
  la rama principal, una protegida ni una en la que trabaja un agente. Si tiene commits que no están en
  la principal o un pull request abierto (que GitHub cierra al borrarla), se pide una segunda
  confirmación diciendo cuántos commits y qué PR.
- **Ramas y worktrees** lista cada checkout del repositorio (`git worktree list`) con cuántos commits
  lleva frente a `main`, lo que tiene sin commit, el diff y el último turno de un agente ahí. También
  permite cambiar la rama del checkout principal. Los hooks que llegan desde un worktree cuentan para
  el proyecto del repositorio principal.
- **Lo último que hizo el agente** (en Resumen, solo para turnos que cambiaron archivos, con un aviso
  en cualquier sección cuando termina): con los hooks `UserPromptSubmit` y `Stop`, cada turno queda
  registrado con el pedido, los pasos, el mensaje final del agente (leído del transcript en
  `~/.claude`), la hora, la duración, la rama y el diff exacto de ese turno. El diff compara contra una
  foto del árbol de trabajo tomada al empezar (`git stash create`, sin tocar el repo), así que los
  cambios previos sin commit no aparecen. Los turnos anteriores están a un clic.
- En Trazabilidad, cada archivo se puede abrir en la pestaña Código; hacer clic en una función o tipo
  marca sus líneas.
- El selector del encabezado (o Ctrl+K) cambia de proyecto desde cualquier pantalla.

Si usas `bun run dev:server`, cada cambio en el código del servidor lo reinicia. Para usar la app sin
esos reinicios (y sin que el reenvío de puertos de VS Code se quede apuntando al proceso anterior),
usa `bun run start`.

### Apariencia

El botón Apariencia del encabezado ofrece los mismos temas que ER Studio (claros, oscuros, alto
contraste, brutalistas y otros), unas 50 fuentes para la interfaz y para el código, y tres tamaños
de texto. La elección se guarda en el navegador.

Las pestañas Pull requests, Ramas y Pipelines usan el `repoUrl` del proyecto. La autenticación se
resuelve en este orden: la variable `GITHUB_TOKEN` del entorno del servidor, luego `gh auth token`
si la CLI de GitHub está instalada y con sesión, y si no, acceso anónimo (solo repos públicos y un
límite de 60 peticiones por hora). Tras iniciar sesión con `gh auth login`, `POST /api/github/auth/refresh`
vuelve a leer el token sin reiniciar. El estado de PRs y ejecuciones se sondea en segundo plano cada
60 segundos para los proyectos abiertos (`GITHUB_POLL_MS`, `0` lo desactiva).

| Endpoint | Qué devuelve |
|---|---|
| `GET /api/github/status` | Tipo de autenticación y límite restante |
| `GET /api/projects/:id/github/pulls` y `/pulls/:number` | PRs y detalle con archivos, reviews, comentarios y checks |
| `GET /api/projects/:id/github/branches` | Ramas remotas con último commit y PR asociado |
| `GET /api/projects/:id/github/workflows`, `/runs` y `/runs/:runId` | Workflows, ejecuciones y jobs con sus pasos |

## Ver en vivo lo que hace Claude Code

Tres capas:

- **Paso a paso:** hooks de Claude Code (`UserPromptSubmit`, `PreToolUse`, `Stop`) envían cada
  paso a `POST /api/agent/hook`. La ficha del proyecto muestra el panel "El agente está
  trabajando" con el paso actual (lee, edita, ejecuta...), los anteriores y los archivos cambiados.
  Se guarda solo en memoria, sin contenido de archivos, y la respuesta es vacía: no gasta tokens.
- **Mientras el agente trabaja:** el servidor vigila el repo de cada proyecto y muestra en
  Trazabilidad la sección "Cambios sin reportar": archivos que cambian, con sus funciones, tipos y
  tests detectados. Todavía sin ordenar. Sin hooks, el mismo panel aparece cuando hay archivos
  cambiados en los últimos 2 minutos.
- **Cuando termina:** el agente llama una vez a `submit_report` con todo lo que hizo, por
  requerimiento y feature: archivos con su propósito, símbolos relevantes, tests con resultado y
  criterios del DoD cumplidos con su evidencia. Entonces aparece ordenado. Se valida completo antes
  de escribir nada, y lo detectado nunca pisa lo reportado.

Un archivo está pendiente cuando su fecha de modificación es posterior al último reporte que lo
cubrió (`pending_changes` por MCP, `GET /api/report/pending?path=<ruta>` por API).

### Hook de cierre para Claude Code

`packages/mcp/src/stop-hook.ts` es un hook `Stop`: si en el turno el agente cambió archivos de un
proyecto y quedan sin reportar, bloquea el cierre una vez y le pide `submit_report`. Fuera de un
proyecto, en turnos sin cambios, en el segundo intento o ante cualquier error, no hace nada. Sin
servidor, con `--db` analiza el repo y lee la base directamente. Configuración en
`~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "timeout": 30,
      "command": "bun /ruta/a/agent-tracking/packages/mcp/src/stop-hook.ts --db /ruta/a/agent-tracking.db" }] }]
  }
}
```

### Hooks de actividad en vivo

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "timeout": 5, "command": "curl -s -o /dev/null -m 1 -X POST -H content-type:application/json --data-binary @- http://127.0.0.1:4317/api/agent/hook || true" }] }],
    "PreToolUse": [{ "hooks": [{ "type": "command", "timeout": 5, "command": "<el mismo comando>" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "timeout": 5, "command": "<el mismo comando>" }] }]
  }
}
```

Con el servidor apagado, `curl` falla al instante y el agente sigue normal. La ficha también
muestra la rama actual del repo local y se actualiza al cambiarla, incluso desde una terminal.

`sync_repo` (MCP) y `POST /api/projects/:id/repo/sync` con `{ "scope": "changes" | "all" }`
fuerzan el análisis; `all` mapea todo el código sin marcarlo pendiente. `AGENT_TRACKING_WATCH=0`
desactiva la vigilancia.

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
3. Análisis del repo (git, tree-sitter, tests) ✅
4. GitHub (PRs, Actions) ✅
5. Asistente LLM (stack, DoD, skills) ✅
6. Gestión de cambios y detección de conflictos
7. Web multiusuario
8. Colaboración
