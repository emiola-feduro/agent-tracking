# Agent Tracking

> Contexto generado por Agent Tracking. Léelo completo antes de trabajar en este proyecto.
> La fuente de verdad es `.agent-tracking/project.json`; este archivo se regenera a partir de él.

## Objetivo

Ver en tiempo real qué construyen los agentes de IA: proyectos con requerimientos y Definition of Done, features, archivos, símbolos y tests, ramas, pull requests y pipelines, con un CONTEXT.md para que cualquier agente se sume al proyecto.

## Ficha técnica

- **Tipo de proyecto:** Aplicación completa
- **Plataformas:** Web, Escritorio
- **Stack:** TypeScript, Bun, Hono, React, Tailwind CSS, Tauri, Rust, Drizzle ORM, Bun test, TanStack Query, TanStack Router, Zustand, Vite, Zod
- **Bases de datos:** SQLite
- **Repositorio:** https://github.com/emiola-feduro/agent-tracking
- **Avance global:** 74%

## Idioma con el usuario

Háblale al usuario en español: tus respuestas, el resumen al terminar cada tarea y el `summary` de `submit_report`. El código y sus comentarios siguen las convenciones del proyecto.

## Convenciones de commits y ramas

_No se definieron convenciones: se usan Conventional Commits por defecto._

- **Formato del mensaje:** `<tipo>(<alcance opcional>): <descripción>`, en español, en imperativo y sin punto final.
- **Ramas:** `<tipo>/<tema-corto>`, por ejemplo `feat/busqueda-por-fecha`. No se trabaja directo en main.
- **Tipos permitidos:**
  - `feat`: Una funcionalidad nueva
  - `fix`: Corrige un error
  - `docs`: Solo documentación
  - `style`: Formato, espacios o punto y coma, sin cambiar la lógica
  - `refactor`: Cambia el código sin corregir errores ni agregar funciones
  - `perf`: Mejora el rendimiento
  - `test`: Agrega o corrige tests
  - `build`: Build o dependencias
  - `ci`: Configuración de integración continua
  - `chore`: Tareas de mantenimiento que no tocan el código de la app
  - `revert`: Revierte un commit anterior
- **Trabajo con git:**
  - Antes de cambiar código, crea una rama desde la rama actual con `git switch -c <tipo>/<tema>` (por ejemplo `feat/exportar-csv`), salvo que ya estés en una rama de trabajo.
  - Haz commits pequeños mientras avanzas y uno al terminar cada tarea, con el formato de estas convenciones. No dejes el trabajo sin commit.
  - Nunca borres, renombres, recrees ni reescribas `main` o `master` (ni la rama principal del remoto): nada de `git branch -D`, `git push --force`, `git push --delete`, `git checkout --orphan` ni `git reset --hard` sobre ella.
  - No uses `git clean -f`, `git filter-branch` ni comandos que descarten trabajo ajeno. Si algo sobra, bórralo por su nombre.
  - No hagas push ni fusiones a main salvo que te lo pidan.

## Reglas de negocio

1. El código y los comentarios van en inglés; el texto de la interfaz, en español
2. El texto de la interfaz no usa guiones largos, puntos medios ni emojis
3. Nunca se escriben claves de API ni tokens en logs ni en archivos del repositorio
4. Los cambios en la configuración persistente del usuario (hooks, settings) se confirman antes
5. Todo lo que se guarda vive en el equipo del usuario: base SQLite local y archivos del repo

## Skills a usar

_No se seleccionaron skills._

## Requerimientos

### RF1 Wizard de creación de proyectos — 100%

ID: `4df55674-d3e6-491d-9ac3-c43e185a3c16`

**Tipo:** Funcional, área frontend

Origen (desde cero, repo nuevo, local o clonado), tipo de proyecto, stack con dependencias, skills, objetivo, reglas, requerimientos con DoD y carpeta .github al final.

**Definition of Done:**

- [x] El tipo de proyecto decide qué partes del stack se ofrecen y la recomendación (`57167353-1627-4151-8858-323090f874cb`)
- [x] Se puede crear un proyecto desde cero, desde un repo local, clonando de GitHub o creando un repo nuevo (`8d6809eb-906a-4d6a-b69e-49ebc5194271`)
- [x] Las tecnologías dependientes (Tailwind, runtimes, ORM) se deshabilitan sin su base (`255bd75a-edb5-4f9f-910d-306569a2a5a9`)
- [x] El pipeline de CI y la plantilla de PR se eligen en el Resumen y la plantilla se edita en Markdown (`af6cce67-e226-47ae-8fe5-c15715b74adf`)

**Features:**

- Wizard de nuevo proyecto — _done_ (`4ee5653d-ad1a-4033-ac57-3f5dad3c08e1`)
  - `apps/web/src/components/dynamic/new-project/new-project-basics.tsx`: Selector de idioma en el paso Proyecto
  - `apps/web/src/components/dynamic/new-project/new-project-github-files.tsx`: CI y plantilla de PR editable en Markdown en el Resumen
  - `apps/web/src/components/dynamic/new-project/new-project-source.tsx`: Paso Origen: desde cero, repo nuevo, local o clonado
  - `apps/web/src/components/dynamic/new-project/new-project-stack-section.tsx`: Sección del stack con botones para agregar lenguajes que abren más opciones.
  - `apps/web/src/stores/use-wizard-store.ts`: Estado replyLanguage del wizard, español por defecto
  - `packages/core/src/github-files.ts`: Genera ci.yml según el stack y la plantilla de pull request
  - `packages/core/src/project-kind.ts`: Tipos de proyecto, con App multiplataforma.
  - `packages/core/src/stack.ts`: Catálogo y recomendación del stack, con App multiplataforma (Flutter).
  - `packages/git/src/index.ts`: Exporta integrate
- Importar requerimientos y planes desde Markdown o JSON — _done_ (`d5c72587-3bd9-487f-bab5-74e76b919371`)
  - `apps/web/src/components/dynamic/new-project/new-project-requirement-card.tsx`: Requerimiento del wizard con sus piezas.
  - `apps/web/src/components/dynamic/new-project/new-project-requirements.tsx`: Paso de requerimientos del wizard con importación.
  - `apps/web/src/components/dynamic/requirements-import/requirements-import-dialog.tsx`: Diálogo para pegar o abrir Markdown o JSON con vista previa de lo entendido.
  - `apps/web/src/hooks/form/use-create-project.ts`: Envía el idioma al crear
  - `apps/web/src/stores/use-wizard-store.ts`: Estado replyLanguage del wizard, español por defecto
  - `packages/core/src/index.ts`: Exporta los módulos de core.
  - `packages/core/src/plan.test.ts`: Tests unitarios del plan con monorepo, tests e idioma
  - `packages/core/src/plan.ts`: Lee del plan la estructura, las piezas, la herramienta de monorepo, los tipos de tests y el idioma, y pregunta por piezas faltantes o inválidas
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
- Convenciones de commits — _done_ (`855fbd27-5249-4b67-8a41-e7b18f0856ca`)
  - `apps/web/src/components/dynamic/commit-conventions/commit-conventions-editor.tsx`: Editor de convenciones del wizard y del proyecto.
  - `apps/web/src/components/dynamic/new-project/new-project-goal.tsx`: Paso Objetivo y reglas con convenciones.
  - `apps/web/src/components/dynamic/project-detail/project-detail-conventions.tsx`: Convenciones editables en Reglas y convenciones.
  - `packages/core/src/context.ts`: Sección Idioma con el usuario en CONTEXT.md
  - `packages/core/src/conventions.ts`: Modelo, valores por defecto y texto para CONTEXT.md.
  - `packages/core/src/plan.ts`: Lee del plan la estructura, las piezas, la herramienta de monorepo, los tipos de tests y el idioma, y pregunta por piezas faltantes o inválidas
  - `packages/db/src/schema.ts`: Tabla app_settings
- Stack guiado por lenguaje — _done_ (`86707f6b-1269-48bc-820a-3ff1d4e937a7`)
  - `apps/web/src/components/dynamic/new-project/new-project-stack-groups.tsx`: Lenguajes compartidos entre piezas.
  - `apps/web/src/components/dynamic/new-project/new-project-stack-section.tsx`: Sección del stack con botones para agregar lenguajes que abren más opciones.
  - `apps/web/src/hooks/form/use-stack-sections.ts`: Secciones del paso Stack: lenguajes aparte y opciones filtradas por lenguaje con los lenguajes que abren más.
  - `packages/core/src/core.test.ts`: Tests del catálogo y del stack guiado por lenguaje.
  - `packages/core/src/project-kind.ts`: Tipos de proyecto, con App multiplataforma.
  - `packages/core/src/stack.ts`: Catálogo y recomendación del stack, con App multiplataforma (Flutter).
- Rama inicial del repositorio nuevo — _done_ (`af7e04d4-633c-4100-99e2-46e3093f6834`)
  - `apps/web/src/components/dynamic/new-project/new-project-source-new.tsx`: Origen Repositorio nuevo con selector de rama principal.
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `packages/git/src/index.ts`: Exporta integrate
  - `packages/git/src/repo.test.ts`: Tests de repositorios, incluida la rama inicial.
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
- Tipos de tests para los agentes — _done_ (`339c5862-66c9-4283-80c0-d72c47b8a3ab`)
  - `apps/web/src/components/dynamic/new-project/new-project-test-types.tsx`: Elección de los tests que deben escribir los agentes.
  - `packages/core/src/test-policy.ts`: Tipos de tests, sugeridos por tipo de proyecto, y su Markdown.

### RF2 Trazabilidad requerimiento, feature, archivo y símbolo — 100%

ID: `10bb951b-b30e-402d-bbeb-6906eac77592`

**Tipo:** Funcional, área frontend

Árbol por requerimiento o por archivo, con búsqueda, símbolos y vista previa del código.

**Definition of Done:**

- [x] Hay una vista por archivo agrupada por carpeta con su requerimiento y feature (`e81952d7-763c-4064-b36b-b18a86baa307`)
- [x] Cada archivo es una tarjeta con su propósito y una tabla de símbolos (`f64c0e45-1572-4d1c-b4cc-196ef561bdbc`)
- [x] La pestaña Código muestra el archivo y marca las líneas del símbolo elegido (`65aa6bff-fd6f-4bb9-9ddd-e2192ee2586f`)

**Features:**

- Trazabilidad por archivo con vista de código — _done_ (`ffddc27b-124c-442f-bfb1-788daca31510`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-by-file.tsx`: Vista por archivo con carpetas plegables.
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-file.tsx`: Tarjeta de archivo con pestañas Símbolos y Código
  - `apps/web/src/components/dynamic/project-detail/project-detail-traceability.tsx`: Trazabilidad: plegado, búsqueda y vista de worktree.
  - `apps/web/src/components/ui/code-view/code-view.tsx`: Código con números de línea y rango marcado
  - `packages/git/src/worktrees.ts`: Worktrees, diffs de turno y borrado de ramas.
- Búsqueda con sugerencias y autocompletado con Tab — _done_ (`8529c6d3-1c4a-4eb4-8f31-e0bdf7bcbd0e`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-traceability.tsx`: Trazabilidad: plegado, búsqueda y vista de worktree.
  - `apps/web/src/components/ui/suggest-input/suggest-input.tsx`: Campo de búsqueda con lista de sugerencias y completado gris que Tab acepta.
  - `apps/web/src/hooks/ui/use-trace-suggestions.ts`: Archivos y símbolos sugeridos para la trazabilidad.
  - `apps/web/src/lib/fuzzy.ts`: Puntaje de coincidencia y texto que completa.
- Features y carpetas plegables — _done_ (`f1e0b768-0473-4877-a495-4eaf473a9157`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-by-file.tsx`: Vista por archivo con carpetas plegables.
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-feature.tsx`: Feature plegable con sus archivos.
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-requirement.tsx`: Requerimiento en la trazabilidad; pasa el plegado y la búsqueda a sus features.
  - `apps/web/src/components/dynamic/project-detail/project-detail-traceability.tsx`: Trazabilidad: plegado, búsqueda y vista de worktree.
- Quitar un test del proyecto — _done_ (`e6efc11f-d764-4277-b6d7-54fc78371946`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-test-group.tsx`: Botón para quitar cada test
  - `apps/web/src/components/dynamic/project-detail/project-detail-tests.tsx`: Conecta el borrado con la lista
  - `apps/web/src/hooks/data/use-test-idea-actions.ts`: removeTest optimista
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `packages/server/src/traceability-routes.ts`: Ruta DELETE /projects/:id/tests/:testId
  - `packages/tracking/src/tracker.ts`: Busca un test por ruta y nombre y borra un feature devolviendo los tests que quedan sin feature

### RF3 Análisis del repositorio en vivo — 100%

ID: `1d788405-8d51-494f-8414-ecb321666721`

**Tipo:** Funcional, área backend

Vigilante del repo que detecta archivos, funciones, clases y tests, y marca lo cambiado sin reportar.

**Definition of Done:**

- [x] El análisis detecta funciones, clases, tipos y tests en TypeScript, JavaScript y Python (`5862bb14-0aa7-4579-88de-e3284a6aa141`)
- [x] El cambio de rama desde la terminal se refleja en la app (`73bc4a2d-36ee-4f3c-923c-07723ad1dd61`)
- [x] Los archivos guardados aparecen como cambios sin reportar sin intervención del agente (`d49933f5-a019-4d0f-bb02-15f4344236dd`)

**Features:**

- Vigilante y análisis del repo — _done_ (`cfe72313-771d-4396-913d-07fddbe38666`)
  - `packages/analyzer/src/analyze.ts`: Análisis incremental del repo con caché por contenido
  - `packages/analyzer/src/symbols.ts`: Extrae funciones, clases, tipos y tests con tree-sitter
  - `packages/git/src/watch.ts`: Vigila el árbol de trabajo y HEAD
  - `packages/server/src/repo-watchers.ts`: El vigilante importa cambios en .agent-tracking y los pone al día al arrancar.
  - `packages/tracking/src/inference.ts`: Análisis del repo; INFERRED_ACTOR ahora viene de core.

### RF4 Servidor MCP y reporte del agente — 100%

ID: `c574c729-d420-4c48-917a-138e34dfab17`

**Tipo:** Funcional, área backend

Herramientas MCP para leer el contexto del proyecto y reportar features, archivos, símbolos, tests, DoD y vistas.

**Definition of Done:**

- [x] submit_report registra features, archivos, símbolos, tests y criterios cumplidos en una llamada (`067a6292-b4e9-4ce5-8633-6571c728556f`)
- [x] El proyecto se resuelve por id o por cualquier ruta del repo, también desde un worktree (`0f2204fa-b31e-449b-b0f1-187a36d95782`)
- [x] get_project_context devuelve el CONTEXT.md del proyecto (`186c1ef8-9d2a-48af-9c6d-695f9c7be4f1`)
- [x] report_screen agrega capturas del repositorio a la galería (`dd301a58-0bb4-4300-9d4d-370cd270d919`)

**Features:**

- Servidor MCP con reporte final — _done_ (`f5c9cab0-f08a-4342-aaf2-b175b3b74ee4`)
  - `packages/core/src/context.ts`: Sección Idioma con el usuario en CONTEXT.md
  - `packages/mcp/src/http.ts`: Revive sesiones MCP desconocidas haciendo el saludo en nombre del agente
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
  - `packages/mcp/src/stdio.ts`: En modo local, el MCP se niega a escribir si la base tiene migraciones que su código no conoce
  - `packages/mcp/src/stop-hook.ts`: Hook Stop que recuerda enviar el reporte
  - `packages/tracking/src/tracker.ts`: Busca un test por ruta y nombre y borra un feature devolviendo los tests que quedan sin feature
- Crear proyecto desde un plan por MCP — _done_ (`40490b16-9821-49bc-a246-7d81b01eb54a`)
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
  - `packages/tracking/src/create-project.ts`: Guarda el idioma al crear el proyecto
  - `packages/tracking/src/index.ts`: Exporta remote-sync
- Conectar agentes y sus instrucciones — _done_ (`3546afd3-3da2-442b-8d2e-f32f4c7a2668`)
  - `apps/web/src/components/dynamic/agents/agent-plan-dialog.tsx`: Muestra la carpeta de cada comando y avisa al aplicar
  - `apps/web/src/components/dynamic/new-project/new-project-basics.tsx`: Selector de idioma en el paso Proyecto
  - `apps/web/src/components/dynamic/project-detail/project-detail-agents.tsx`: Estado de MCP viejo y botón Actualizar
  - `apps/web/src/lib/line-diff.ts`: Diff por líneas para archivos de configuración.
  - `packages/agents/src/connect.test.ts`: Tests de conexión en un HOME temporal.
  - `packages/agents/src/connect.ts`: Plan de conexión por HTTP para Claude Code, Codex y Gemini; detecta y reemplaza la conexión de proceso local
  - `packages/core/src/agent-context.ts`: Pide pasar project si el MCP no reconoce el proyecto
  - `packages/server/src/agent-files.test.ts`: Tests de los archivos de instrucciones.
  - `packages/server/src/agent-routes.test.ts`: Tests de las rutas de agentes.
  - `packages/server/src/agent-routes.ts`: La lista de agentes incluye los modelos de su proveedor
  - `packages/skills/src/index.ts`: Skills también en .agents/skills y en la carpeta de Gemini.
  - `packages/tracking/src/repo-sync.ts`: Exporta withLock, mergeTrees, sameTree y notifyRepoImport para la sincronización remota

### RF5 Actividad en vivo y turnos del agente — 100%

ID: `b9e42b00-b7cf-4bf5-86d8-a59bf92cb3af`

**Tipo:** Funcional, área backend

Hooks de Claude Code sin costo de tokens: pasos en vivo y resumen de cada turno con pedido, mensaje final y diff.

**Definition of Done:**

- [x] Cada turno guarda pedido, pasos, mensaje final, rama, duración y su diff exacto (`052ef931-df84-4412-9e76-7e205b9010ab`)
- [x] Solo se leen transcripts dentro de ~/.claude (`6e749177-f5c5-47b4-9832-49970cd2621b`)
- [x] El panel en vivo muestra el paso actual y los anteriores (`84bf366b-e5c9-4357-9612-b72ce884009e`)
- [x] Los hooks responden 204 sin salida, así que no gastan tokens (`c73d3bc7-f455-4e23-b4d8-77e8e647b749`)

**Features:**

- Hooks en vivo y resumen de turnos — _done_ (`41655f5e-8ac6-4b7b-b47c-39410ac5ff7a`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-last-turn.tsx`: Resumen del último turno con cambios.
  - `apps/web/src/components/dynamic/project-detail/project-detail-live.tsx`: Panel en vivo con el nombre de cada agente.
  - `apps/web/src/components/ui/diff-view/diff-view.tsx`: Diff por archivo con líneas coloreadas
  - `packages/server/src/agent-turns.ts`: Ciclo de vida de los turnos: inicio, mensajes a mitad, cierre con diff y resumen.
  - `packages/server/src/live-activity.ts`: Actividad en vivo por sesión y agente.
- Resumen tras cada trabajo del agente — _done_ (`d9f0e399-e47e-4dfa-a37b-c5f0efd76cb5`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-turn-toast.tsx`: Aviso de trabajo terminado con enlace al resumen.
  - `packages/git/src/worktrees.test.ts`: Tests de worktrees, diff del turno y archivos sin commit.
  - `packages/git/src/worktrees.ts`: Worktrees, diffs de turno y borrado de ramas.
  - `packages/server/src/agent-turns.ts`: Ciclo de vida de los turnos: inicio, mensajes a mitad, cierre con diff y resumen.
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/features-v3.test.ts`: Tests de turnos, imágenes, worktrees e importación.
  - `packages/server/src/live-activity.ts`: Actividad en vivo por sesión y agente.
- Seguimiento de Codex CLI y Gemini CLI — _done_ (`a8021746-6f16-480d-af64-7d9a91068c3e`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-live.tsx`: Panel en vivo con el nombre de cada agente.
  - `packages/agents/src/agents.test.ts`: Tests de los adaptadores con los formatos documentados.
  - `packages/agents/src/claude-code.ts`: Claude Code acepta contexto por pedido
  - `packages/agents/src/codex.ts`: Codex acepta contexto por pedido
  - `packages/agents/src/describe.ts`: Respuesta de hook con additionalContext
  - `packages/agents/src/gemini-cli.ts`: Adaptador de Gemini CLI: BeforeAgent, BeforeTool, AfterAgent.
  - `packages/agents/src/index.ts`: Registro de adaptadores y utilidades (adapterFor, agentForClient, agentLabel).
  - `packages/agents/src/types.ts`: withPromptContext en el adaptador
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
  - `packages/server/src/agents-flow.test.ts`: Codex y Gemini a la vez: sesiones en vivo y turnos.
  - `packages/server/src/live-activity.ts`: Actividad en vivo por sesión y agente.
  - `packages/tracking/src/agent-turns.ts`: Turnos con agente, y turnos por MCP para agentes sin hooks.

### RF6 Ramas y worktrees — 100%

ID: `c7ed0a4f-c79e-40e3-8390-b1aa22d3523c`

**Tipo:** Funcional, área frontend

Ver el progreso de cada worktree frente a main y cambiar la rama del checkout principal.

**Definition of Done:**

- [x] Se puede cambiar de rama y git lo impide con cambios sin commit (`1536647c-7003-4c84-b209-fda5901e4e56`)
- [x] Cada worktree muestra commits adelante, cambios sin commit y su diff (`c5fc176c-e069-44a5-b823-c18e2083d417`)

**Features:**

- Pestaña Ramas y worktrees — _done_ (`fcec5305-a2d0-4043-a3ed-05b381b633f7`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-worktrees.tsx`: Lista de ramas con botón de borrar y motivo cuando no se puede.
  - `packages/git/src/repo.ts`: Errores de git con códigos unmerged e in_use.
  - `packages/server/src/repo-routes.ts`: POST /projects/:id/repo/integrate, bloqueado si un agente trabaja en la rama
- Menú de rama y worktree — _done_ (`3eb20a0d-6864-4eba-ac5a-88e24ff870b0`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-checkout-menu.tsx`: Menú desplegable de ramas y worktrees.
  - `apps/web/src/components/dynamic/project-detail/project-detail-worktree-banner.tsx`: Aviso y diff del worktree que se está viendo.
  - `apps/web/src/components/dynamic/project-detail/project-detail.tsx`: Monta la tarjeta en el resumen
  - `apps/web/src/hooks/ui/use-checkout-view.ts`: Worktree que se mira, guardado en la URL.
  - `apps/web/src/router.tsx`: Acepta la pestaña collab
- Borrar ramas locales — _done_ (`1d2f82f5-e0fe-45d5-aaeb-100a8d5b7351`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-worktrees.tsx`: Lista de ramas con botón de borrar y motivo cuando no se puede.
  - `apps/web/src/hooks/data/use-worktrees.ts`: Consultas y mutaciones de ramas y worktrees.
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `packages/git/src/repo.ts`: Errores de git con códigos unmerged e in_use.
  - `packages/git/src/worktrees.ts`: Worktrees, diffs de turno y borrado de ramas.
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/delete-branch.test.ts`: Tests del borrado de ramas.
  - `packages/server/src/repo-routes.ts`: POST /projects/:id/repo/integrate, bloqueado si un agente trabaja en la rama
- Integrar una rama en main y subirla desde la app — _done_ (`c7404e54-2b90-49e6-89c9-401c3089661e`)
  - `apps/web/src/components/dynamic/agent-runs/agent-runs-list.tsx`: Integrar y subir en cada trabajo terminado con commits pendientes
  - `apps/web/src/components/dynamic/project-detail/project-detail-integrate.tsx`: Usa el hook compartido y explica cuándo se podrá integrar
  - `apps/web/src/components/dynamic/project-detail/project-detail.tsx`: Monta la tarjeta en el resumen
  - `apps/web/src/hooks/data/use-integrate.ts`: Lógica compartida de integrar con confirmación y resultado
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `packages/git/src/index.ts`: Exporta integrate
  - `packages/git/src/integrate.ts`: Integra una rama en la principal en un worktree temporal y la sube sin forzar
  - `packages/server/src/agent-run-routes.ts`: Los trabajos recuerdan la rama en la que terminaron; runningCwds
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/repo-routes.ts`: POST /projects/:id/repo/integrate, bloqueado si un agente trabaja en la rama

### RF7 Integración con GitHub — 100%

ID: `d48566db-3202-417a-a0ff-2fa359fdc596`

**Tipo:** Funcional, área backend

Pull requests, ramas remotas y GitHub Actions del repoUrl del proyecto.

**Definition of Done:**

- [x] Se listan pull requests con diff, reviews y comentarios (`0f4ebb54-5f86-48bf-aec6-0c7d2ebd5a7d`)
- [x] La autenticación usa GITHUB_TOKEN, gh auth token o acceso anónimo (`bcfc37ed-59f6-4072-962d-114a699eabef`)
- [x] Se listan ejecuciones de GitHub Actions con jobs y logs (`e31b1a80-d215-4b31-b1d0-1507e33b78f4`)

**Features:**

- Pull requests, ramas y pipelines de GitHub — _done_ (`88321b05-2eeb-4232-8bce-97b07a1d66cf`)
  - `packages/github/src/auth.ts`: Token desde GITHUB_TOKEN, gh o acceso anónimo
  - `packages/github/src/client.ts`: Cliente de GitHub; commits adelante y borrado de ramas.
  - `packages/server/src/github-routes.ts`: Rutas de GitHub; DELETE de ramas con sus reglas y marca de agente en la lista.
  - `packages/server/src/github-watcher.ts`: Sondeo en segundo plano
- Crear el repositorio en GitHub — _done_ (`8c5456a5-9aa0-46c3-9471-175fde0ba9c1`)
  - `apps/web/src/components/dynamic/github-publish/github-publish-fields.tsx`: Campos de cuenta, nombre y visibilidad.
  - `apps/web/src/components/dynamic/github-publish/github-publish-panel.tsx`: Publicar desde el Resumen del proyecto.
  - `apps/web/src/components/dynamic/new-project/new-project-github-publish.tsx`: Opción del wizard para crear el repo en GitHub.
  - `apps/web/src/hooks/form/use-create-project.ts`: Envía el idioma al crear
  - `apps/web/src/stores/use-notice-store.ts`: Avisos de una sola vez para la página del proyecto.
  - `packages/git/src/github-publish.ts`: Cuenta de GitHub y publicación del repo con gh.
  - `packages/server/src/github-publish.test.ts`: Tests con un gh simulado.
  - `packages/server/src/repo-routes.ts`: POST /projects/:id/repo/integrate, bloqueado si un agente trabaja en la rama
- Borrar ramas en GitHub — _done_ (`18cdc4ea-0b92-482d-a3d1-e082fe4c4cd1`)
  - `apps/web/src/components/dynamic/github-branches/github-branch-row.tsx`: Fila de rama remota con botón de borrar y motivo cuando no se puede.
  - `apps/web/src/components/dynamic/github-branches/github-branches.tsx`: Lista de ramas en GitHub.
  - `apps/web/src/hooks/data/use-github-branches.ts`: Lista y borrado de ramas con doble confirmación.
  - `apps/web/src/lib/github-api.ts`: Cliente web de las rutas de GitHub.
  - `packages/github/src/client.ts`: Cliente de GitHub; commits adelante y borrado de ramas.
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/github-delete-branch.test.ts`: Tests del borrado de ramas en GitHub con fetch simulado.
  - `packages/server/src/github-routes.ts`: Rutas de GitHub; DELETE de ramas con sus reglas y marca de agente en la lista.
- CI de Agent Tracking en GitHub Actions — _done_ (`5ad82298-fbd4-4fd2-96ed-1c656f6b8e28`)
  - `.github/workflows/ci.yml`: Pipeline de CI: typecheck, check de la web, tests y build con Bun 1.4.2.

### RF8 Asistente con Claude — 100%

ID: `765effdd-4d83-4567-90eb-483ec5c56034`

**Tipo:** Funcional, área backend

Sugerencias de stack, criterios del DoD y skills con Claude, con respaldo determinista.

**Definition of Done:**

- [x] Las respuestas del modelo pasan por las mismas reglas del catálogo (`028ad7a1-b2c6-40d4-ba05-c8ea1fde2e77`)
- [x] Sin asistente configurado, el wizard usa la recomendación determinista (`e1388175-e647-4108-b929-ba078bd59bda`)

**Features:**

- Asistente de stack, DoD y skills — _done_ (`eb414879-3201-4d99-9b1e-a3043e0aed50`)
  - `packages/assistant/src/claude-code.ts`: Proveedor Claude Code CLI.
  - `packages/assistant/src/dod.ts`: Usa el modelo de la tarea dod
  - `packages/assistant/src/stack.ts`: Usa el modelo de la tarea stack
- Botones que gastan tokens — _done_ (`abd40f70-d2b9-4a69-bedd-08d4841a629d`)
  - `apps/web/src/components/dynamic/new-project/new-project-requirement-dod.tsx`: DoD del wizard; Sugerir con IA con TokenButton.
  - `apps/web/src/components/dynamic/new-project/new-project-stack-assistant.tsx`: Sugerencia de stack con TokenButton.
  - `apps/web/src/components/dynamic/project-detail/project-detail-dod.tsx`: Implementar por criterio y casilla de selección de criterios pendientes
  - `apps/web/src/components/ui/token-button/token-button.tsx`: Dice de quién son los tokens que gasta.
- Proveedores del asistente — _done_ (`cd9f791e-6d22-496a-933c-50a50921b753`)
  - `apps/web/src/components/dynamic/assistant/assistant-provider-picker.tsx`: Muestra los modelos en uso y el selector por tarea
  - `apps/web/src/components/ui/token-button/token-button.tsx`: Dice de quién son los tokens que gasta.
  - `apps/web/src/hooks/data/use-assistant-providers.ts`: setModel
  - `packages/assistant/src/claude-code.ts`: Proveedor Claude Code CLI.
  - `packages/assistant/src/client.ts`: Tareas del asistente, modelos sugeridos y modelFor
  - `packages/assistant/src/codex-cli.ts`: Proveedor Codex CLI no interactivo.
  - `packages/assistant/src/errors.ts`: Errores del asistente.
  - `packages/assistant/src/gemini-cli.ts`: Proveedor Gemini CLI no interactivo.
  - `packages/assistant/src/gemini.ts`: Proveedor Gemini por API con esquema de respuesta.
  - `packages/assistant/src/openai.ts`: Proveedor OpenAI con salida estructurada.
  - `packages/assistant/src/providers.test.ts`: Tests de los proveedores con fetch y spawn simulados.
  - `packages/assistant/src/spawn.ts`: Ejecución de CLIs con tiempo límite y carpeta aislada.
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/assistant.test.ts`: Tests de las rutas del asistente.
  - `packages/server/src/index.ts`: Recuerda la carpeta de cada agente según sus hooks para el MCP por HTTP
- Modelo por tarea del asistente — _done_ (`4b340d32-362f-4378-bb2c-c250c397cd83`)
  - `apps/web/src/components/dynamic/assistant/assistant-provider-picker.tsx`: Muestra los modelos en uso y el selector por tarea
  - `apps/web/src/components/dynamic/assistant/assistant-task-models.tsx`: Selector de modelo por tarea
  - `apps/web/src/hooks/data/use-assistant-providers.ts`: setModel
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `packages/assistant/src/client.ts`: Tareas del asistente, modelos sugeridos y modelFor
  - `packages/assistant/src/dod.ts`: Usa el modelo de la tarea dod
  - `packages/assistant/src/skills.ts`: Usa el modelo de la tarea skills
  - `packages/assistant/src/stack.ts`: Usa el modelo de la tarea stack
  - `packages/db/migrations/0011_aberrant_the_twelve.sql`: Migración de app_settings
  - `packages/db/src/schema.ts`: Tabla app_settings
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha

### RF9 Referencias visuales y galería de vistas — 100%

ID: `f497fa5f-cde3-4420-bd49-ee7c7832680f`

**Tipo:** Funcional, área frontend

Imágenes en requerimientos y criterios del DoD, y galería de pantallas de la app.

**Definition of Done:**

- [x] Solo se aceptan imágenes raster verificadas por su contenido (`1c5868f8-3115-4e71-a031-9d732e4c3418`)
- [x] Se adjuntan imágenes arrastrando, eligiendo o pegando con Ctrl+V (`44307941-a929-478c-8148-d842aebf59bb`)
- [x] Las referencias se copian a .agent-tracking/attachments y se listan en CONTEXT.md (`ded9ac9f-a5d3-4946-876a-9850f05ffadd`)

**Features:**

- Imágenes de referencia y galería de vistas — _done_ (`e7d7a963-cd1a-43a3-995d-b5ab4e76cca4`)
  - `apps/web/src/components/dynamic/attachments/attachment-drop.tsx`: Arrastrar, elegir o pegar imágenes
  - `apps/web/src/components/dynamic/project-detail/project-detail-screens.tsx`: Galería de vistas agrupada por feature
  - `packages/server/src/attachment-routes.ts`: Subir, servir, editar y borrar imágenes
  - `packages/tracking/src/attachments.ts`: Valida y guarda imágenes, compartido por la API y el MCP

### RF10 Requerimientos funcionales y no funcionales con filtros — 100%

ID: `9ccf8f6a-06c6-4692-b38d-c0d4cb41e467`

**Tipo:** Funcional, área frontend

Tipo y área en cada requerimiento, agrupados y filtrables.

**Definition of Done:**

- [x] Se filtra por tipo, área y texto (`4753d5a2-b57f-4dbe-a73e-49f474834989`)
- [x] Cada requerimiento tiene tipo y área editables (`800c8648-c628-4de0-b459-e6fa6c445b21`)

**Features:**

- Tipo, área y filtros de requerimientos — _done_ (`e20e7af5-350b-42e3-9997-73c58a0975ad`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Implementar para los criterios pendientes y casilla que los marca todos
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirements.tsx`: Botón Seleccionar para implementar, barra y diálogo
  - `packages/core/src/requirements.ts`: Etiquetas y clasificación de requerimientos.
- Clasificación por parte del sistema o atributo de calidad — _done_ (`11fce3fd-7e0f-46db-ae30-20e2566cbb7b`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Implementar para los criterios pendientes y casilla que los marca todos
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-classification.tsx`: Edición de tipo y área explicada, con sugerencia del texto.
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-form.tsx`: Formulario de nuevo requerimiento.
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirements.tsx`: Botón Seleccionar para implementar, barra y diálogo
  - `apps/web/src/components/dynamic/requirement-classification/classification-fields.tsx`: Tipo y área para requerimientos nuevos, deducidos por defecto.
  - `apps/web/src/hooks/data/use-project-actions.ts`: Actualizar requerimientos, incluidas sus piezas.
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/lib/labels.ts`: Etiquetas en español y opciones de área por tipo.
  - `packages/core/src/requirements.ts`: Etiquetas y clasificación de requerimientos.
  - `packages/core/src/types.ts`: Project.replyLanguage
  - `packages/server/src/features-v3.test.ts`: Tests de turnos, imágenes, worktrees e importación.

### RNF1 Accesible y usable en móvil — 50%

ID: `308a7bc8-83d9-46e1-a443-745d4fef719d`

**Tipo:** No funcional, área usabilidad

Navegación con teclado, roles ARIA y diseño sin desplazamiento horizontal a 390 px.

**Definition of Done:**

- [x] Las pantallas principales no se desplazan en horizontal a 390 px (`5bc3a656-b647-4b4b-8b3c-b56a5eb6f1ee`)
- [ ] Los controles personalizados tienen rol, nombre accesible y funcionan con teclado (`cfcd7a51-c7a8-42d8-a0e1-1f135313f887`)

**Features:**

- Diseño adaptable y selector de proyectos — _done_ (`bc892359-fa8e-49bf-9e13-6d988fa6f21b`)
  - `apps/web/src/components/dynamic/project-switcher/project-switcher.tsx`: Selector de proyectos; abre Resumen.
  - `apps/web/src/components/ui/tabs/tabs.tsx`: Pestañas desplazables sin barra vertical
- Navegación con sidebar — _done_ (`b667d6f3-afef-4d8c-926e-a68abe6d09bf`)
  - `apps/web/src/components/dynamic/new-project/new-project-repo-result.tsx`: Textos del wizard que hablan de la carpeta .agent-tracking.
  - `apps/web/src/components/dynamic/project-detail/project-detail-nav.tsx`: Ícono de Colaboración
  - `apps/web/src/components/dynamic/project-detail/project-detail.tsx`: Monta la tarjeta en el resumen
  - `apps/web/src/components/dynamic/project-switcher/project-switcher.tsx`: Selector de proyectos; abre Resumen.
  - `apps/web/src/hooks/form/use-repo-source.ts`: Importa o clona el repo y abre el Resumen.
  - `apps/web/src/router.tsx`: Acepta la pestaña collab

### RNF2 La app se recupera sola de reinicios del servidor — 100%

ID: `38a44436-a323-49d5-a1ce-248c8dc01ad8`

**Tipo:** No funcional, área rendimiento

Peticiones con tiempo límite y reintentos, y recarga al reconectar el WebSocket.

**Definition of Done:**

- [x] Al reconectar el WebSocket se vuelven a pedir los datos (`0c6e5672-8b8a-425a-994d-f69689216c57`)
- [x] Las lecturas se cortan a los 12 segundos y se reintentan (`8d2eeccb-f552-49bd-86bf-1163dfab18b5`)

**Features:**

- Reintentos y recarga al reconectar — _done_ (`4e182ef9-9a67-474a-81f0-7b4b51e2a032`)
  - `apps/web/src/hooks/data/use-live-events.ts`: WebSocket que recarga todo al reconectar
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/lib/query-client.ts`: Reintentos para errores de red y del servidor
- Comando bun run dev — _done_ (`0adf724c-6460-4bbf-9154-c3bd491dbb35`)
  - `README.md`: Documenta el trabajo en equipo con el servidor compartido
  - `package.json`: Script dev.
  - `scripts/dev.ts`: Levanta la API con --watch, espera su health y luego Vite, con salida prefijada y cierre conjunto.

### RNF3 Apariencia — 100%

ID: `f66fb380-a480-42a5-b45f-433928f2a081`

**Tipo:** No funcional, área usabilidad

Temas, fuentes y tamaño de texto como en ER Studio.

**Definition of Done:**

- [x] Se eligen fuentes para la interfaz y para el código, y tres tamaños de texto (`aedcc16b-9b35-414e-9d1c-97115699998e`)
- [x] Se elige entre los temas claros y oscuros, y se mantiene al recargar sin destello (`b47e1c2d-43e0-4393-8e20-0b0fca034bbe`)

**Features:**

- Temas, fuentes y tamaño de texto — _done_ (`bda900d8-220f-4412-9227-a2e92219919b`)
  - `apps/web/src/components/dynamic/appearance/appearance-dialog.tsx`: Diálogo Apariencia
  - `apps/web/src/hooks/ui/use-apply-appearance.ts`: Aplica variables, fuentes y tamaño al documento
  - `apps/web/src/lib/appearance/fonts.ts`: Fuentes por categoría y carga desde Google Fonts
  - `apps/web/src/lib/appearance/themes.ts`: Temas de ER Studio más los de Agent Tracking
- Pantalla de carga inicial — _done_ (`8d8933d7-208e-4949-89ee-9858ddbd952a`)
  - `apps/desktop/src-tauri/tauri.conf.json`: Color de fondo de la ventana de escritorio
  - `apps/web/index.html`: Pantalla de carga sin espera de entrada y con fundido corto
  - `apps/web/src/main.tsx`: Retira la pantalla de carga en cuanto la app renderiza

### RF11 Web multiusuario y colaboración — 100%

ID: `6512a2ba-bffe-4427-b835-b3740aa1fab3`

**Tipo:** Funcional, área infraestructura

Fases 7 y 8: PostgreSQL, autenticación, equipos, roles y presencia.

**Definition of Done:**

- [x] La app de escritorio puede sincronizar con un servidor compartido (`37358a45-94a4-4ac6-b55b-123d61637ac1`)
- [x] Varias personas trabajan en el mismo proyecto con roles (`5f5fe41b-c0b7-44bf-a3dc-3a5d1fce84ee`)

**Features:**

- Servidor compartido con cuentas, roles y presencia — _done_ (`c84e696d-e652-49e8-9a75-2de99907962c`)
  - `README.md`: Documenta el trabajo en equipo con el servidor compartido
  - `packages/collab/package.json`: Paquete del servidor compartido con su binario
  - `packages/collab/src/client.ts`: Cliente del servidor compartido usado por la app local
  - `packages/collab/src/collab.test.ts`: Tests del servidor compartido: cuentas, roles y presencia
  - `packages/collab/src/index.ts`: Exporta el paquete collab
  - `packages/collab/src/roles.ts`: Roles por proyecto y qué acciones permite cada uno
  - `packages/collab/src/serve.ts`: Arranca el servidor compartido con DATABASE_URL y COLLAB_PORT
  - `packages/collab/src/server.ts`: API HTTP del servidor compartido con autenticación y permisos por rol
  - `packages/collab/src/store.ts`: Almacenamiento del servidor compartido en PostgreSQL o SQLite con el mismo SQL
- Sincronización de la app de escritorio con el servidor compartido — _done_ (`9b13ab0e-44e6-43ef-95c0-e97c1f782a48`)
  - `packages/server/package.json`: Depende de collab
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/collab-routes.ts`: Rutas locales de conexión, compartir, sincronizar, miembros y presencia; el token nunca sale del servidor local
  - `packages/tracking/package.json`: Depende de collab
  - `packages/tracking/src/index.ts`: Exporta remote-sync
  - `packages/tracking/src/remote-sync.ts`: Sincroniza la base local con el servidor compartido mediante un merge de 3 vías
  - `packages/tracking/src/repo-sync.ts`: Exporta withLock, mergeTrees, sameTree y notifyRepoImport para la sincronización remota
- Sección Colaboración en la web — _done_ (`284215ee-a603-4def-8386-db00fa9b5a15`)
  - `apps/web/src/components/dynamic/collab/collab-connect.tsx`: Formulario para iniciar sesión o crear cuenta en el servidor compartido
  - `apps/web/src/components/dynamic/collab/collab-members.tsx`: Personas del proyecto con sus roles
  - `apps/web/src/components/dynamic/collab/collab-project.tsx`: Sección Colaboración: estado, compartir, sincronizar y presencia
  - `apps/web/src/components/dynamic/collab/collab-shared-projects.tsx`: Proyectos compartidos contigo que se pueden traer a esta máquina
  - `apps/web/src/components/dynamic/project-detail/project-detail-nav.tsx`: Ícono de Colaboración
  - `apps/web/src/components/dynamic/project-detail/project-detail.tsx`: Monta la tarjeta en el resumen
  - `apps/web/src/hooks/data/use-collab.ts`: Hooks de conexión, sincronización, miembros y presencia con latido
  - `apps/web/src/lib/collab-api.ts`: Tipos y llamadas a las rutas de colaboración
  - `apps/web/src/lib/query-keys.ts`: Claves de consulta de colaboración
  - `apps/web/src/pages/projects-page.tsx`: Muestra los proyectos compartidos contigo
  - `apps/web/src/router.tsx`: Acepta la pestaña collab
  - `docs/screens/colaboracion.png`: Captura de la sección Colaboración

### RF12 Gestión de cambios y detección de conflictos — 0%

ID: `80d5080e-093a-4db8-8d2b-78e060067521`

**Tipo:** Funcional, área backend

Fase 6: solicitudes de cambio con análisis de conflictos y revisiones.

**Definition of Done:**

- [ ] Un cambio a requerimientos o reglas se crea como solicitud con reporte de conflictos (`5b995b43-b991-4536-97a8-5d34bc635787`)
- [ ] Al aprobar se guarda una revisión y los features afectados pasan a revisión (`7dff790a-a354-42a0-a94d-0d7fa28ff3c7`)

### RNF4 Seguridad de rutas y datos locales — 100%

ID: `d9d9a456-5385-4793-918a-de1ab104db5e`

**Tipo:** No funcional, área seguridad

Nada se lee ni se escribe fuera del repo del proyecto, y nada sensible sale del equipo.

**Definition of Done:**

- [x] Las rutas de archivos se validan dentro del repo, incluidos los enlaces simbólicos (`b2e4892f-11a6-44eb-8eca-1c9b0cf5fc2b`)
- [x] Los worktrees pedidos se validan contra git worktree list (`d51c31d5-4301-404e-874d-487d4cbeca1e`)

**Features:**

- Validación de rutas y worktrees — _done_ (`229342a4-9fb9-48b6-9ad5-3532951f1d1b`)
  - `packages/git/src/repo.ts`: Errores de git con códigos unmerged e in_use.
  - `packages/server/src/repo-routes.ts`: POST /projects/:id/repo/integrate, bloqueado si un agente trabaja en la rama
- Solo páginas de este equipo — _done_ (`2643a8cc-df59-4ebb-a845-e574b2b3ebc7`)
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/index.ts`: Recuerda la carpeta de cada agente según sus hooks para el MCP por HTTP
  - `packages/server/src/origin.test.ts`: Tests de orígenes permitidos.
  - `packages/server/src/origin.ts`: Qué orígenes pueden llamar al servidor.

### RF13 Compartir el proyecto por git — 100%

ID: `e871c9a5-c03f-4fd2-a1e7-e2e2e6214af1`

**Tipo:** Funcional, área backend

Quien clona el repo importa el mismo proyecto, con sus imágenes y sus skills.

**Definition of Done:**

- [x] Las skills personales se pueden incluir en el repo e instalar en otro equipo (`26607921-a38a-4a7f-a462-05c2c31e2f4b`)
- [x] Al importar desde el repo se restauran las imágenes de referencia y de vistas (`74d018a8-c7c2-4168-807e-2858d433aa8b`)
- [x] Las skills de un plugin se instalan desde su marketplace con Claude Code (`99a6fe1e-cc88-4945-899b-f856e2c9f7bf`)

**Features:**

- Imágenes y skills que viajan con el repo — _done_ (`d112f799-8c92-465e-9c42-3cb4cb8ffceb`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-skills.tsx`: Pestaña Skills con estado, instalar y compartir
  - `apps/web/src/hooks/data/use-skill-status.ts`: Consulta el estado y lanza instalar o compartir
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/lib/query-keys.ts`: Claves de consulta de colaboración
  - `packages/core/src/context.ts`: Sección Idioma con el usuario en CONTEXT.md
  - `packages/core/src/core.test.ts`: Tests del catálogo y del stack guiado por lenguaje.
  - `packages/core/src/project-file.ts`: replyLanguage viaja en project.json; los archivos anteriores toman español
  - `packages/core/src/requirements.ts`: Etiquetas y clasificación de requerimientos.
  - `packages/core/src/types.ts`: Project.replyLanguage
  - `packages/db/src/migrations.gen.ts`: Migración con plugin, marketplace y compartida en las skills
  - `packages/db/src/schema.ts`: Tabla app_settings
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/portable.test.ts`: Test de un proyecto que pasa de un equipo a otro con imágenes y skills
  - `packages/server/src/skill-routes.ts`: Estado de las skills en este equipo e instalación
  - `packages/skills/src/index.ts`: Skills también en .agents/skills y en la carpeta de Gemini.
  - `packages/skills/src/portable.ts`: Origen de las skills, copia al repo e instalación en otro equipo
  - `packages/tracking/src/repo-sync.ts`: Exporta withLock, mergeTrees, sameTree y notifyRepoImport para la sincronización remota
- Colaboración por git sin conflictos — _done_ (`aae78170-f499-46db-bd20-2b6ad56c5cc3`)
  - `README.md`: Documenta el trabajo en equipo con el servidor compartido
  - `apps/web/src/components/dynamic/new-project/new-project-repo-result.tsx`: Textos del wizard que hablan de la carpeta .agent-tracking.
  - `packages/core/src/index.ts`: Exporta los módulos de core.
  - `packages/core/src/json-merge.ts`: Merge de 3 vías de JSON: objetos por clave, entidades por id, ruta o nombre, y listas simples como conjuntos.
  - `packages/core/src/merge-layout.test.ts`: Tests del merge JSON y del formato v2.
  - `packages/core/src/project-file.ts`: replyLanguage viaja en project.json; los archivos anteriores toman español
  - `packages/core/src/project-tree.ts`: Formato v2 de .agent-tracking: parte y reúne el proyecto en archivos por entidad con orden estable.
  - `packages/core/src/types.ts`: Project.replyLanguage
  - `packages/git/src/index.ts`: Exporta integrate
  - `packages/git/src/merge-driver.ts`: Registra un driver de merge en la config local y hace el merge de líneas de respaldo.
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/server/src/app.test.ts`: Tests del API adaptados al formato v2.
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/index.ts`: Recuerda la carpeta de cada agente según sus hooks para el MCP por HTTP
  - `packages/server/src/repo-watchers.ts`: El vigilante importa cambios en .agent-tracking y los pone al día al arrancar.
  - `packages/tracking/src/inference.ts`: Análisis del repo; INFERRED_ACTOR ahora viene de core.
  - `packages/tracking/src/merge-driver-info.ts`: Nombre del driver y ruta del script.
  - `packages/tracking/src/merge-driver.ts`: Script que git ejecuta como driver: combina JSON por entradas, conserva CONTEXT.md y cae al merge de líneas en conflictos reales.
  - `packages/tracking/src/repo-sync.test.ts`: Tests con git real: merges en dos ramas, conflictos, importación tras pull, checkout, marcas y migración v1.
  - `packages/tracking/src/repo-sync.ts`: Exporta withLock, mergeTrees, sameTree y notifyRepoImport para la sincronización remota

### RF14 Wizard de scaffolding: proyectos multiplataforma y monorepos — 0%

ID: `896c5df9-1cea-4396-945d-d993a92190af`

**Tipo:** Funcional, área frontend

Hoy el paso Proyecto obliga a elegir un solo tipo (app móvil, API, web...), así que no se puede describir una app multiplataforma ni un monorepo con varias piezas (por ejemplo app móvil + API + panel web + librería compartida). El wizard debe permitir describir el proyecto por piezas o apps, cada una con su tipo, plataformas, ubicación en el repo y stack, y usar esa estructura para guiar el stack, el CONTEXT.md y las convenciones, y para proponer el scaffolding inicial del repositorio.

**Definition of Done:**

- [ ] Un tipo de proyecto con interfaz admite varias plataformas a la vez (web, escritorio y móvil) y ofrece frameworks multiplataforma como Flutter, Kotlin Multiplatform o .NET MAUI (`02b517f5-582e-4241-9a96-4fb340c4f95f`)
- [ ] El paso Stack muestra un stack por pieza, guiado por lenguaje, y permite compartir lenguaje y herramientas entre piezas (`0ea60ac0-08c3-4274-92b3-7a98de5313f0`)
- [ ] En un monorepo se agregan, editan y quitan piezas, cada una con nombre, tipo (web, móvil, escritorio, API, CLI, librería), plataformas y carpeta (por ejemplo apps/mobile, apps/api, packages/shared) (`1698c6c6-9908-45de-bf24-802b0d6c8d72`)
- [ ] El resumen muestra un árbol de carpetas propuesto antes de crear el proyecto, y se puede crear ese scaffolding mínimo (carpetas, manifiestos y README por pieza) sin pisar archivos existentes (`29bfe2c3-b21e-455f-be48-e8d96ff89267`)
- [ ] El paso Proyecto permite elegir estructura: una sola app o monorepo con varias piezas (`c7c3c749-c588-494b-9643-ae2e63467a7b`)
- [ ] La estructura por piezas se guarda en .agent-tracking y aparece en CONTEXT.md, para que los agentes sepan dónde va cada cosa; los requerimientos pueden asociarse a una o varias piezas (`dcb0aa5e-5247-4418-92c6-5fb8b08ac50d`)
- [ ] Se elige la herramienta del monorepo cuando aplica (workspaces de Bun, pnpm o npm, Turborepo, Nx, Melos para Flutter, Gradle multiproyecto) (`f319dd2c-0c8d-4d22-b976-2f750e29152b`)
- [ ] Importar un repositorio existente detecta un monorepo (workspaces, pubspec, settings.gradle) y propone sus piezas (`ffd0210f-9404-44f4-9ff7-f43553dc2d57`)
- [ ] Hay tests del modelo de piezas, del árbol propuesto y del scaffolding, y una prueba en el navegador de crear un monorepo móvil + API + web (`cb2cf0e8-9fe9-4cc0-abec-4c87ba4f2d69`)

**Features:**

- Monorepos y piezas en el wizard — _done_ (`b8ace81c-984b-4166-979b-ffb57f50780b`)
  - `apps/web/src/components/dynamic/new-project/new-project-basics.tsx`: Selector de idioma en el paso Proyecto
  - `apps/web/src/components/dynamic/new-project/new-project-monorepo-tool.tsx`: Elección de la herramienta del monorepo.
  - `apps/web/src/components/dynamic/new-project/new-project-parts.tsx`: Editor de piezas del monorepo.
  - `apps/web/src/components/dynamic/new-project/new-project-stack-groups.tsx`: Lenguajes compartidos entre piezas.
  - `apps/web/src/components/dynamic/new-project/new-project-stack-parts.tsx`: Pestañas de stack por pieza.
  - `apps/web/src/components/dynamic/new-project/new-project-stack.tsx`: Paso Stack con piezas, herramienta y tests.
  - `apps/web/src/hooks/form/use-create-project.ts`: Envía el idioma al crear
  - `apps/web/src/hooks/form/use-stack-defaults.ts`: Recomendación por pieza.
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/stores/use-wizard-store.ts`: Estado replyLanguage del wizard, español por defecto
  - `packages/core/src/agent-context.ts`: Pide pasar project si el MCP no reconoce el proyecto
  - `packages/core/src/context.ts`: Sección Idioma con el usuario en CONTEXT.md
  - `packages/core/src/index.ts`: Exporta los módulos de core.
  - `packages/core/src/parts.ts`: Modelo de piezas, herramientas de monorepo, validación, árbol propuesto, scaffolding y Markdown de estructura.
  - `packages/core/src/project-file.ts`: replyLanguage viaja en project.json; los archivos anteriores toman español
  - `packages/core/src/project-kind.ts`: Tipos de proyecto, con App multiplataforma.
  - `packages/core/src/stack.ts`: Catálogo y recomendación del stack, con App multiplataforma (Flutter).
  - `packages/core/src/types.ts`: Project.replyLanguage
  - `packages/db/migrations/0009_jazzy_banshee.sql`: Migración de estructura, piezas, herramienta y tests.
  - `packages/db/src/schema.ts`: Tabla app_settings
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/tracking/src/create-project.ts`: Guarda el idioma al crear el proyecto
- Árbol propuesto y scaffolding — _done_ (`51788bf5-ecb2-4f79-9da1-1b92108b75ee`)
  - `apps/web/src/components/dynamic/new-project/new-project-scaffold.tsx`: Árbol de carpetas propuesto y casilla para crearlo.
  - `apps/web/src/components/dynamic/new-project/new-project-summary.tsx`: Fila Idioma de los agentes en el resumen
  - `packages/core/src/parts.test.ts`: Tests del modelo de piezas, herramientas, árbol y scaffolding.
  - `packages/server/src/monorepo.test.ts`: Tests de proyectos monorepo: creación, scaffolding, piezas y detección.
- Piezas por requerimiento — _done_ (`c0cb7044-3df7-4e2e-8c97-184687d1417c`)
  - `apps/web/src/components/dynamic/new-project/new-project-requirement-card.tsx`: Requerimiento del wizard con sus piezas.
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Implementar para los criterios pendientes y casilla que los marca todos
  - `apps/web/src/components/dynamic/requirement-parts/part-chips.tsx`: Selector de piezas que toca un requerimiento.
  - `apps/web/src/hooks/data/use-project-actions.ts`: Actualizar requerimientos, incluidas sus piezas.
- Detectar monorepos al importar — _done_ (`55ee76eb-d776-438f-90f8-64ac3f500bf0`)
  - `packages/tracking/src/detect-structure.test.ts`: Tests de detección de monorepos.
  - `packages/tracking/src/detect-structure.ts`: Detecta las piezas de un monorepo existente con su tipo y stack.
  - `packages/tracking/src/index.ts`: Exporta remote-sync

### RF15 Idioma de las respuestas y resúmenes de los agentes — 0%

ID: `3a96fb8a-6ddb-45e5-9e6e-f1895d6e86ce`

**Tipo:** Funcional, área general

Cada proyecto define en qué idioma le hablan los agentes al usuario: respuestas, resúmenes de fin de trabajo y el resumen de submit_report. Se elige en el wizard y se cambia cuando se quiera desde la página del proyecto; el cambio llega a Claude Code, Codex y Gemini sin tocar su configuración. El código y sus comentarios siguen las convenciones del proyecto, no este ajuste.

**Definition of Done:**

- [ ] Tests unitarios y de integración cubren el ajuste, el contexto y el hook (`16524155-237d-4613-b0af-38d71ac211df`)
- [ ] El wizard deja elegir el idioma y el resumen lo muestra (`483257f1-1970-4557-95d4-68b9c9a4b02e`)
- [ ] CONTEXT.md y el bloque de CLAUDE.md, AGENTS.md y GEMINI.md piden responder y resumir en ese idioma (`7c8a055a-abc2-47ff-93df-2c68e3cf06f1`)
- [ ] La página del proyecto permite cambiar el idioma en cualquier momento (`89cd0a73-798f-4caa-b315-5f7c0b7888b2`)
- [ ] El proyecto guarda el idioma de las respuestas (español por defecto, o sin indicar) y viaja en .agent-tracking/project.json (`f49ce20e-d006-4f9a-a105-4ddda38d57f1`)
- [ ] Con hooks, cada pedido nuevo recuerda el idioma, así un cambio aplica en sesiones ya abiertas (`f91a9951-af9b-4514-acbf-dc80356eab00`)

**Features:**

- Idioma de las respuestas por proyecto — _done_ (`7d36f0ee-67f5-4bde-8281-4032899658b0`)
  - `apps/web/src/components/dynamic/agents/reply-language-field.tsx`: Selector del idioma reutilizado en el wizard y en la página del proyecto
  - `apps/web/src/components/dynamic/new-project/new-project-basics.tsx`: Selector de idioma en el paso Proyecto
  - `apps/web/src/components/dynamic/new-project/new-project-summary.tsx`: Fila Idioma de los agentes en el resumen
  - `apps/web/src/components/dynamic/project-detail/project-detail-agents.tsx`: Estado de MCP viejo y botón Actualizar
  - `apps/web/src/hooks/form/use-create-project.ts`: Envía el idioma al crear
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/stores/use-wizard-store.ts`: Estado replyLanguage del wizard, español por defecto
  - `packages/agents/src/claude-code.ts`: Claude Code acepta contexto por pedido
  - `packages/agents/src/codex.ts`: Codex acepta contexto por pedido
  - `packages/agents/src/describe.ts`: Respuesta de hook con additionalContext
  - `packages/agents/src/types.ts`: withPromptContext en el adaptador
  - `packages/core/src/agent-context.ts`: Pide pasar project si el MCP no reconoce el proyecto
  - `packages/core/src/context.ts`: Sección Idioma con el usuario en CONTEXT.md
  - `packages/core/src/project-file.ts`: replyLanguage viaja en project.json; los archivos anteriores toman español
  - `packages/core/src/reply-language.ts`: Idiomas disponibles, etiquetas y la regla que reciben los agentes
  - `packages/core/src/types.ts`: Project.replyLanguage
  - `packages/db/migrations/0010_safe_deathbird.sql`: Migración que agrega reply_language
  - `packages/db/src/schema.ts`: Tabla app_settings
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/tracking/src/create-project.ts`: Guarda el idioma al crear el proyecto

### RF16 Nuevas funcionalidades del MCP — 56%

ID: `0e260d37-411a-4cdf-a8d9-2b65b7ef86bb`

**Tipo:** Funcional, área integraciones

Mejoras del servidor MCP para que los agentes trabajen con menos tokens, menos errores y sin depender de la API local: escribir requerimientos, contexto enfocado, validación y corrección de reportes, continuidad entre sesiones, comandos listos, create_project completo y conexión por HTTP.

**Definition of Done:**

- [ ] submit_report avisa o rechaza rutas fuera del repositorio, ids de DoD que no existen y archivos que no cambiaron (`0a6d624b-57a6-4aaf-831f-68ef674d53fb`)
- [x] get_handoff dice qué hizo el último turno, con qué agente y en qué rama, qué criterios del DoD siguen pendientes y qué cambios faltan por reportar (`25dcbdd4-5864-4e45-9428-028680c7bbea`)
- [x] Conectar registra el MCP por HTTP (http://127.0.0.1:4317/mcp) sin depender de Bun ni del código fuente (`38fea0f6-4829-420b-86a6-6ea5d07f8ca1`)
- [x] remove_test y remove_feature permiten deshacer lo que se reportó por error (`8a2f53c1-6b13-4f70-b423-3dddd750f436`)
- [x] create_project admite monorepo con sus piezas, tipos de tests e idioma de las respuestas, igual que el wizard (`8c9da401-b983-48d6-9f14-456605b23518`)
- [x] Prompts MCP en inglés que aparecen como comandos: /agent-tracking:start <requirement> y /agent-tracking:report (`cc79f882-023c-46df-846d-b2e1479195b1`)
- [ ] get_project_context tiene un modo compacto (objetivo, reglas, convenciones, idioma y la lista de requerimientos con su avance) y el detalle se pide con get_requirement (`e93e33e2-92d4-4b64-a644-8fd643049e8b`)
- [ ] El contexto y cada requerimiento se exponen como recursos MCP: agent-tracking://context y agent-tracking://requirement/<id> (`e9662a32-7b7d-454c-858b-351b2749706c`)
- [ ] El MCP permite crear y editar requerimientos: create_requirement (con DoD, tipo, área y piezas), update_requirement y add_dod_item (`f5ca1c04-dc03-42d4-b63b-3a94bdc0e8fc`)

**Features:**

- MCP por HTTP y aviso de conexión vieja — _done_ (`7dcbda15-b02e-49d2-9796-2f835dd5832c`)
  - `apps/web/src/components/dynamic/agents/agent-connection-banner.tsx`: Aviso en todas las páginas con botón para actualizar la conexión
  - `apps/web/src/components/dynamic/agents/agent-plan-dialog.tsx`: Muestra la carpeta de cada comando y avisa al aplicar
  - `apps/web/src/components/dynamic/project-detail/project-detail-agents.tsx`: Estado de MCP viejo y botón Actualizar
  - `apps/web/src/components/layout/app-shell/app-shell.tsx`: Monta el aviso
  - `packages/agents/src/connect.ts`: Plan de conexión por HTTP para Claude Code, Codex y Gemini; detecta y reemplaza la conexión de proceso local
  - `packages/core/src/agent-context.ts`: Pide pasar project si el MCP no reconoce el proyecto
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
  - `packages/server/src/agent-routes.ts`: La lista de agentes incluye los modelos de su proveedor
  - `packages/server/src/app.ts`: agentOnBranch: solo sesiones trabajando ahora o agentes lanzados en marcha
  - `packages/server/src/index.ts`: Recuerda la carpeta de cada agente según sus hooks para el MCP por HTTP
- Sesiones MCP que sobreviven a reinicios — _done_ (`7558f3be-5f92-446f-bfca-98223726efac`)
  - `packages/mcp/src/http.ts`: Revive sesiones MCP desconocidas haciendo el saludo en nombre del agente
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/mcp/src/stdio.ts`: En modo local, el MCP se niega a escribir si la base tiene migraciones que su código no conoce
- get_handoff para retomar el trabajo — _done_ (`0c5a9934-dd37-4f9b-8254-2155628b2392`)
  - `packages/mcp/src/handoff.test.ts`: Tests de buildHandoff
  - `packages/mcp/src/handoff.ts`: Arma el traspaso: último turno terminado, criterios pendientes y cambios sin reportar
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
- Prompts MCP start y report — _done_ (`e8d4ca0d-5780-4790-be9d-4ce1a74dd936`)
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
- remove_test y remove_feature — _done_ (`44200e9c-c40d-44b4-a37d-9128ba6ada5b`)
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard
  - `packages/tracking/src/tracker.ts`: Busca un test por ruta y nombre y borra un feature devolviendo los tests que quedan sin feature
- create_project completo como el wizard — _done_ (`3dc3a513-d922-422a-adf7-ed9242831357`)
  - `packages/core/src/plan.test.ts`: Tests unitarios del plan con monorepo, tests e idioma
  - `packages/core/src/plan.ts`: Lee del plan la estructura, las piezas, la herramienta de monorepo, los tipos de tests y el idioma, y pregunta por piezas faltantes o inválidas
  - `packages/mcp/src/mcp.test.ts`: Test de integración de create_project con un monorepo por un cliente MCP
  - `packages/mcp/src/server.ts`: get_plan_format explica monorepo, tests e idioma; create_project pasa estructura, piezas, herramienta, tipos de tests e idioma a createProject con los valores por defecto del wizard

### RF17 Códigos de requerimiento — 0%

ID: `315d11ab-fd02-45bd-9701-bf012f24b293`

**Tipo:** Funcional, área general

Cada requerimiento tiene un código corto y secuencial dentro del proyecto según su tipo (RF1, RNF2...), editable, que sirve para referirse a él en la app, en el contexto y en el MCP sin escribir el título completo.

**Definition of Done:**

- [ ] El código viaja en .agent-tracking y se muestra en CONTEXT.md, en la lista de requerimientos y en el wizard (`0fc98970-62c4-4232-8e70-3c760d3feb65`)
- [ ] Cada requerimiento recibe un código secuencial por tipo al crearse (RF para funcionales, RNF para no funcionales) y los existentes reciben el suyo por orden de creación (`8e8a4a53-634f-440f-820d-b6d07ae31942`)
- [ ] El código se puede editar desde la app y no se repite dentro del proyecto (`eeba8618-3d93-41d5-9c14-87460240eb05`)
- [ ] Las herramientas del MCP aceptan el código donde piden un requerimiento (`0c4c4447-4b31-45a7-bd22-9dd5e100b1e6`)
- [ ] Tests cubren la numeración, la edición, los duplicados y el uso desde el MCP (`f00198bb-6a1f-4e5d-9b46-1fc6b76a140f`)

### RF18 Lanzar agentes desde Agent Tracking — 100%

ID: `34551e71-2c57-40ae-9102-773ca2f7cb0a`

**Tipo:** Funcional, área integraciones

Desde un requerimiento se elige el agente (Claude Code, Codex CLI o Gemini CLI) y Agent Tracking lo arranca con esa tarea en el repositorio o en un worktree, con el nivel de permisos elegido. Su trabajo se ve en vivo, queda en una lista de trabajos lanzados con su estado y se puede detener.

**Definition of Done:**

- [x] Se elige dónde trabaja (checkout principal o un worktree existente) y con qué permisos, con un aviso claro del modo sin preguntas (`3cda502f-9f37-4bc7-bb56-e20ae722deda`)
- [x] Los trabajos lanzados se listan con agente, requerimiento, estado, duración y las últimas líneas de salida, y se pueden detener (`68ca55d4-9fcb-4723-a1b3-bf96579ca502`)
- [x] Tests cubren el armado del comando de cada agente, el arranque, la salida, la detención y el rechazo de orígenes ajenos (`781610f2-116b-4e38-b4b9-b668b0a110f7`)
- [x] El agente arranca sin interfaz con una instrucción que nombra el requerimiento por su código, pide leer el contexto, trabajar en una rama propia y llamar a submit_report al terminar (`79861d3d-c761-4adf-9a5d-010305a3cb88`)
- [x] Desde un requerimiento se abre «Implementar con un agente» y se elige el agente entre los instalados (`d5e7f319-7a87-462e-8e9d-9f4d6ba0eaaf`)
- [x] Solo se lanzan agentes desde la propia app (origen local); nunca desde otra página (`e10f40e1-68b5-40cf-8e54-1b73c516aa41`)
- [x] Un requerimiento sin criterios cumplidos se implementa con un clic (Implementar) usando las últimas opciones; Opciones abre el diálogo (`1cc56bbb-a004-46e1-a55b-424bf976b2a3`)
- [x] Cada criterio pendiente del DoD tiene su propio botón Implementar (`4eda528f-f643-4d8a-ae39-ae85e5bd0eed`)
- [x] Se pueden seleccionar varios requerimientos sin criterios cumplidos y varios criterios pendientes y entregarlos en orden a un solo agente (`af9da3fc-6480-495f-b0fb-1bd7f557f723`)
- [x] Si ya hay un agente trabajando en la misma carpeta, el trabajo nuevo queda en cola y arranca al terminar el anterior (`4a3c6dab-0f29-4384-b903-15b68077fc70`)

**Features:**

- Lanzar agentes desde un requerimiento — _done_ (`57265620-f44f-45c5-bf18-a3d6cf432511`)
  - `apps/web/src/components/dynamic/agent-runs/agent-runs-list.tsx`: Integrar y subir en cada trabajo terminado con commits pendientes
  - `apps/web/src/components/dynamic/agent-runs/launch-agent-dialog.tsx`: Elección de criterios, modelos del agente y rama
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Implementar para los criterios pendientes y casilla que los marca todos
  - `apps/web/src/hooks/data/use-agent-runs.ts`: Tipo de lanzamiento con rama
  - `packages/agents/src/launch.ts`: Regla de rama en la instrucción según la elección
  - `packages/server/src/agent-run-routes.ts`: Los trabajos recuerdan la rama en la que terminaron; runningCwds
- Implementar con un clic, selección múltiple y cola — _done_ (`f5bacdee-1555-4f1a-8451-8f5e6a6dfc89`)
  - `apps/web/src/components/dynamic/agent-runs/agent-runs-list.tsx`: Integrar y subir en cada trabajo terminado con commits pendientes
  - `apps/web/src/components/dynamic/agent-runs/implement-bar.tsx`: Texto de ayuda de la selección
  - `apps/web/src/components/dynamic/agent-runs/launch-agent-dialog.tsx`: Elección de criterios, modelos del agente y rama
  - `apps/web/src/components/dynamic/project-detail/project-detail-dod.tsx`: Implementar por criterio y casilla de selección de criterios pendientes
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Implementar para los criterios pendientes y casilla que los marca todos
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirements.tsx`: Botón Seleccionar para implementar, barra y diálogo
  - `apps/web/src/hooks/data/use-agent-runs.ts`: Tipo de lanzamiento con rama
  - `apps/web/src/hooks/data/use-implement.ts`: Pasa la rama al lanzar
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/stores/use-implement-store.ts`: setDods marca o desmarca varios criterios
  - `packages/agents/src/launch.ts`: Regla de rama en la instrucción según la elección
  - `packages/core/src/implement.ts`: Qué se puede implementar: requerimiento sin criterios cumplidos, criterio pendiente
  - `packages/server/src/agent-run-routes.ts`: Los trabajos recuerdan la rama en la que terminaron; runningCwds
- Modelos por agente, rama y criterios pendientes — _done_ (`2b3ca38c-3405-4cb5-b118-c5b88fda607d`)
  - `apps/web/src/components/dynamic/agent-runs/implement-bar.tsx`: Texto de ayuda de la selección
  - `apps/web/src/components/dynamic/agent-runs/launch-agent-dialog.tsx`: Elección de criterios, modelos del agente y rama
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Implementar para los criterios pendientes y casilla que los marca todos
  - `apps/web/src/hooks/data/use-agent-runs.ts`: Tipo de lanzamiento con rama
  - `apps/web/src/hooks/data/use-implement.ts`: Pasa la rama al lanzar
  - `apps/web/src/lib/api.ts`: workBranch en AgentRun
  - `apps/web/src/stores/use-implement-store.ts`: setDods marca o desmarca varios criterios
  - `packages/agents/src/launch.ts`: Regla de rama en la instrucción según la elección
  - `packages/server/src/agent-routes.ts`: La lista de agentes incluye los modelos de su proveedor
  - `packages/server/src/agent-run-routes.ts`: Los trabajos recuerdan la rama en la que terminaron; runningCwds

## Vistas de la app

- Colaboración del proyecto (`/projects/$projectId?tab=collab`): `.agent-tracking/attachments/5f272316-colaboracion.png`

## Ideas de tests pendientes

- Auditoría con teclado y lector de pantalla del wizard, el selector de proyectos y los diálogos (`573b8b64-4533-4f91-877b-02a2075b4602`)
- Correr collab.test.ts contra un PostgreSQL real (DATABASE_URL) en el CI (`87a30488-3a67-41a0-9873-43d5935a4dbc`)
- Sincronizar un proyecto con imágenes adjuntas entre dos máquinas sin repo compartido (`093934df-5582-4d0f-ab3f-c3c4a59a73c3`)

## Cómo reportar tu trabajo

Este proyecto se rastrea vía el servidor MCP de Agent Tracking. Antes de empezar un feature llama a `start_feature`;
reporta cada archivo con `report_file`, sus funciones/variables con `report_symbol`, los tests con `report_test`
y marca los criterios del DoD con `mark_dod_item` cuando tengas evidencia. Al terminar llama a `complete_feature`.
Si se te ocurre un caso que valga la pena probar y no vas a escribirlo ahora, regístralo con `suggest_test_idea`.
