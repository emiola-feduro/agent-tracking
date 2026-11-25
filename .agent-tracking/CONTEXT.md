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
- **Avance global:** 85%

## Reglas de negocio

1. El código y los comentarios van en inglés; el texto de la interfaz, en español
2. El texto de la interfaz no usa guiones largos, puntos medios ni emojis
3. Nunca se escriben claves de API ni tokens en logs ni en archivos del repositorio
4. Los cambios en la configuración persistente del usuario (hooks, settings) se confirman antes
5. Todo lo que se guarda vive en el equipo del usuario: base SQLite local y archivos del repo

## Skills a usar

_No se seleccionaron skills._

## Requerimientos

### Wizard de creación de proyectos — 100%

ID: `4df55674-d3e6-491d-9ac3-c43e185a3c16`

**Tipo:** Funcional, área frontend

Origen (desde cero, repo nuevo, local o clonado), tipo de proyecto, stack con dependencias, skills, objetivo, reglas, requerimientos con DoD y carpeta .github al final.

**Definition of Done:**

- [x] Se puede crear un proyecto desde cero, desde un repo local, clonando de GitHub o creando un repo nuevo (`8d6809eb-906a-4d6a-b69e-49ebc5194271`)
- [x] El tipo de proyecto decide qué partes del stack se ofrecen y la recomendación (`57167353-1627-4151-8858-323090f874cb`)
- [x] Las tecnologías dependientes (Tailwind, runtimes, ORM) se deshabilitan sin su base (`255bd75a-edb5-4f9f-910d-306569a2a5a9`)
- [x] El pipeline de CI y la plantilla de PR se eligen en el Resumen y la plantilla se edita en Markdown (`af6cce67-e226-47ae-8fe5-c15715b74adf`)

**Features:**

- Wizard de nuevo proyecto — _done_ (`4ee5653d-ad1a-4033-ac57-3f5dad3c08e1`)
  - `apps/web/src/components/dynamic/new-project/new-project-basics.tsx`: Paso Proyecto: nombre, tipo de proyecto y plataformas
  - `apps/web/src/components/dynamic/new-project/new-project-github-files.tsx`: CI y plantilla de PR editable en Markdown en el Resumen
  - `apps/web/src/components/dynamic/new-project/new-project-source.tsx`: Paso Origen: desde cero, repo nuevo, local o clonado
  - `apps/web/src/components/dynamic/new-project/new-project-stack-section.tsx`: Opciones del stack con grupos exclusivos y dependencias deshabilitadas
  - `apps/web/src/stores/use-wizard-store.ts`: Estado del wizard, validación de pasos y resumen para el asistente
  - `packages/core/src/github-files.ts`: Genera ci.yml según el stack y la plantilla de pull request
  - `packages/core/src/project-kind.ts`: Tipos de proyecto y catálogo de stack que aplica a cada uno
  - `packages/core/src/stack.ts`: Catálogo de tecnologías, reglas de consistencia y recomendación por tipo
  - `packages/git/src/index.ts`: Inspección, clonado y creación de repos, y escritura de archivos nuevos

### Servidor MCP y reporte del agente — 100%

ID: `c574c729-d420-4c48-917a-138e34dfab17`

**Tipo:** Funcional, área backend

Herramientas MCP para leer el contexto del proyecto y reportar features, archivos, símbolos, tests, DoD y vistas.

**Definition of Done:**

- [x] get_project_context devuelve el CONTEXT.md del proyecto (`186c1ef8-9d2a-48af-9c6d-695f9c7be4f1`)
- [x] submit_report registra features, archivos, símbolos, tests y criterios cumplidos en una llamada (`067a6292-b4e9-4ce5-8633-6571c728556f`)
- [x] report_screen agrega capturas del repositorio a la galería (`dd301a58-0bb4-4300-9d4d-370cd270d919`)
- [x] El proyecto se resuelve por id o por cualquier ruta del repo, también desde un worktree (`0f2204fa-b31e-449b-b0f1-187a36d95782`)

**Features:**

- Servidor MCP con reporte final — _done_ (`f5c9cab0-f08a-4342-aaf2-b175b3b74ee4`)
  - `packages/core/src/context.ts`: CONTEXT.md apunta a la copia compartida o al plugin de cada skill
  - `packages/mcp/src/http.ts`: Transporte Streamable HTTP en /mcp
  - `packages/mcp/src/server.ts`: Definición de las herramientas MCP sobre el tracker compartido
  - `packages/mcp/src/stdio.ts`: Transporte stdio para clientes locales
  - `packages/mcp/src/stop-hook.ts`: Hook Stop que recuerda enviar el reporte
  - `packages/tracking/src/tracker.ts`: Escritura de features, archivos, símbolos y tests, y resolución del proyecto por ruta o worktree

### Análisis del repositorio en vivo — 100%

ID: `1d788405-8d51-494f-8414-ecb321666721`

**Tipo:** Funcional, área backend

Vigilante del repo que detecta archivos, funciones, clases y tests, y marca lo cambiado sin reportar.

**Definition of Done:**

- [x] Los archivos guardados aparecen como cambios sin reportar sin intervención del agente (`d49933f5-a019-4d0f-bb02-15f4344236dd`)
- [x] El análisis detecta funciones, clases, tipos y tests en TypeScript, JavaScript y Python (`5862bb14-0aa7-4579-88de-e3284a6aa141`)
- [x] El cambio de rama desde la terminal se refleja en la app (`73bc4a2d-36ee-4f3c-923c-07723ad1dd61`)

**Features:**

- Vigilante y análisis del repo — _done_ (`cfe72313-771d-4396-913d-07fddbe38666`)
  - `packages/analyzer/src/analyze.ts`: Análisis incremental del repo con caché por contenido
  - `packages/analyzer/src/symbols.ts`: Extrae funciones, clases, tipos y tests con tree-sitter
  - `packages/git/src/watch.ts`: Vigila el árbol de trabajo y HEAD
  - `packages/server/src/repo-watchers.ts`: Un vigilante por proyecto con repo
  - `packages/tracking/src/inference.ts`: Registra lo detectado como inferido y lo liga al feature en curso

### Trazabilidad requerimiento, feature, archivo y símbolo — 100%

ID: `10bb951b-b30e-402d-bbeb-6906eac77592`

**Tipo:** Funcional, área frontend

Árbol por requerimiento o por archivo, con búsqueda, símbolos y vista previa del código.

**Definition of Done:**

- [x] Cada archivo es una tarjeta con su propósito y una tabla de símbolos (`f64c0e45-1572-4d1c-b4cc-196ef561bdbc`)
- [x] Hay una vista por archivo agrupada por carpeta con su requerimiento y feature (`e81952d7-763c-4064-b36b-b18a86baa307`)
- [x] La pestaña Código muestra el archivo y marca las líneas del símbolo elegido (`65aa6bff-fd6f-4bb9-9ddd-e2192ee2586f`)

**Features:**

- Trazabilidad por archivo con vista de código — _done_ (`ffddc27b-124c-442f-bfb1-788daca31510`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-by-file.tsx`: Archivos agrupados por carpeta con su requerimiento y feature
  - `apps/web/src/components/dynamic/project-detail/project-detail-trace-file.tsx`: Tarjeta de archivo con pestañas Símbolos y Código
  - `apps/web/src/components/dynamic/project-detail/project-detail-traceability.tsx`: Vista por requerimiento o por archivo, búsqueda y expandir todo
  - `apps/web/src/components/ui/code-view/code-view.tsx`: Código con números de línea y rango marcado
  - `packages/git/src/worktrees.ts`: Lectura de archivos para vista previa, worktrees y diffs

### Actividad en vivo y turnos del agente — 100%

ID: `b9e42b00-b7cf-4bf5-86d8-a59bf92cb3af`

**Tipo:** Funcional, área backend

Hooks de Claude Code sin costo de tokens: pasos en vivo y resumen de cada turno con pedido, mensaje final y diff.

**Definition of Done:**

- [x] Los hooks responden 204 sin salida, así que no gastan tokens (`c73d3bc7-f455-4e23-b4d8-77e8e647b749`)
- [x] El panel en vivo muestra el paso actual y los anteriores (`84bf366b-e5c9-4357-9612-b72ce884009e`)
- [x] Cada turno guarda pedido, pasos, mensaje final, rama, duración y su diff exacto (`052ef931-df84-4412-9e76-7e205b9010ab`)
- [x] Solo se leen transcripts dentro de ~/.claude (`6e749177-f5c5-47b4-9832-49970cd2621b`)

**Features:**

- Hooks en vivo y resumen de turnos — _done_ (`41655f5e-8ac6-4b7b-b47c-39410ac5ff7a`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-last-turn.tsx`: Tarjeta del último turno con resumen, cambios y pasos
  - `apps/web/src/components/dynamic/project-detail/project-detail-live.tsx`: Panel con el paso actual y los anteriores
  - `apps/web/src/components/ui/diff-view/diff-view.tsx`: Diff por archivo con líneas coloreadas
  - `packages/server/src/agent-turns.ts`: Registra cada turno con pedido, pasos, mensaje final y diff
  - `packages/server/src/live-activity.ts`: Estado en memoria de lo que hace el agente

### Ramas y worktrees — 100%

ID: `c7ed0a4f-c79e-40e3-8390-b1aa22d3523c`

**Tipo:** Funcional, área frontend

Ver el progreso de cada worktree frente a main y cambiar la rama del checkout principal.

**Definition of Done:**

- [x] Cada worktree muestra commits adelante, cambios sin commit y su diff (`c5fc176c-e069-44a5-b823-c18e2083d417`)
- [x] Se puede cambiar de rama y git lo impide con cambios sin commit (`1536647c-7003-4c84-b209-fda5901e4e56`)

**Features:**

- Pestaña Ramas y worktrees — _done_ (`fcec5305-a2d0-4043-a3ed-05b381b633f7`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-worktrees.tsx`: Worktrees con progreso y diff, y cambio de rama local
  - `packages/git/src/repo.ts`: resolveRepoPath valida rutas dentro del repo siguiendo enlaces
  - `packages/server/src/repo-routes.ts`: checkoutOf solo acepta worktrees del repositorio

### Integración con GitHub — 100%

ID: `d48566db-3202-417a-a0ff-2fa359fdc596`

**Tipo:** Funcional, área backend

Pull requests, ramas remotas y GitHub Actions del repoUrl del proyecto.

**Definition of Done:**

- [x] Se listan pull requests con diff, reviews y comentarios (`0f4ebb54-5f86-48bf-aec6-0c7d2ebd5a7d`)
- [x] Se listan ejecuciones de GitHub Actions con jobs y logs (`e31b1a80-d215-4b31-b1d0-1507e33b78f4`)
- [x] La autenticación usa GITHUB_TOKEN, gh auth token o acceso anónimo (`bcfc37ed-59f6-4072-962d-114a699eabef`)

**Features:**

- Pull requests, ramas y pipelines de GitHub — _done_ (`88321b05-2eeb-4232-8bce-97b07a1d66cf`)
  - `packages/github/src/auth.ts`: Token desde GITHUB_TOKEN, gh o acceso anónimo
  - `packages/github/src/client.ts`: Cliente de la API de GitHub
  - `packages/server/src/github-routes.ts`: Rutas de PRs, ramas y ejecuciones
  - `packages/server/src/github-watcher.ts`: Sondeo en segundo plano

### Asistente con Claude — 100%

ID: `765effdd-4d83-4567-90eb-483ec5c56034`

**Tipo:** Funcional, área backend

Sugerencias de stack, criterios del DoD y skills con Claude, con respaldo determinista.

**Definition of Done:**

- [x] Sin asistente configurado, el wizard usa la recomendación determinista (`e1388175-e647-4108-b929-ba078bd59bda`)
- [x] Las respuestas del modelo pasan por las mismas reglas del catálogo (`028ad7a1-b2c6-40d4-ba05-c8ea1fde2e77`)

**Features:**

- Asistente de stack, DoD y skills — _done_ (`eb414879-3201-4d99-9b1e-a3043e0aed50`)
  - `packages/assistant/src/claude-code.ts`: Usa el Claude Code instalado como proveedor
  - `packages/assistant/src/dod.ts`: Criterios del DoD sugeridos
  - `packages/assistant/src/stack.ts`: Sugerencia de stack normalizada con el catálogo

### Referencias visuales y galería de vistas — 100%

ID: `f497fa5f-cde3-4420-bd49-ee7c7832680f`

**Tipo:** Funcional, área frontend

Imágenes en requerimientos y criterios del DoD, y galería de pantallas de la app.

**Definition of Done:**

- [x] Se adjuntan imágenes arrastrando, eligiendo o pegando con Ctrl+V (`44307941-a929-478c-8148-d842aebf59bb`)
- [x] Las referencias se copian a .agent-tracking/attachments y se listan en CONTEXT.md (`ded9ac9f-a5d3-4946-876a-9850f05ffadd`)
- [x] Solo se aceptan imágenes raster verificadas por su contenido (`1c5868f8-3115-4e71-a031-9d732e4c3418`)

**Features:**

- Imágenes de referencia y galería de vistas — _done_ (`e7d7a963-cd1a-43a3-995d-b5ab4e76cca4`)
  - `apps/web/src/components/dynamic/attachments/attachment-drop.tsx`: Arrastrar, elegir o pegar imágenes
  - `apps/web/src/components/dynamic/project-detail/project-detail-screens.tsx`: Galería de vistas agrupada por feature
  - `packages/server/src/attachment-routes.ts`: Subir, servir, editar y borrar imágenes
  - `packages/tracking/src/attachments.ts`: Valida y guarda imágenes, compartido por la API y el MCP

### Requerimientos funcionales y no funcionales con filtros — 100%

ID: `9ccf8f6a-06c6-4692-b38d-c0d4cb41e467`

**Tipo:** Funcional, área frontend

Tipo y área en cada requerimiento, agrupados y filtrables.

**Definition of Done:**

- [x] Cada requerimiento tiene tipo y área editables (`800c8648-c628-4de0-b459-e6fa6c445b21`)
- [x] Se filtra por tipo, área y texto (`4753d5a2-b57f-4dbe-a73e-49f474834989`)

**Features:**

- Tipo, área y filtros de requerimientos — _done_ (`e20e7af5-350b-42e3-9997-73c58a0975ad`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirement-card.tsx`: Tipo y área editables, referencias visuales y DoD
  - `apps/web/src/components/dynamic/project-detail/project-detail-requirements.tsx`: Agrupa por tipo y filtra por tipo, área y texto
  - `packages/core/src/requirements.ts`: Ruta de la copia compartida de una skill en el repo

### Apariencia — 100%

ID: `f66fb380-a480-42a5-b45f-433928f2a081`

**Tipo:** No funcional, área experiencia de uso

Temas, fuentes y tamaño de texto como en ER Studio.

**Definition of Done:**

- [x] Se elige entre los temas claros y oscuros, y se mantiene al recargar sin destello (`b47e1c2d-43e0-4393-8e20-0b0fca034bbe`)
- [x] Se eligen fuentes para la interfaz y para el código, y tres tamaños de texto (`aedcc16b-9b35-414e-9d1c-97115699998e`)

**Features:**

- Temas, fuentes y tamaño de texto — _done_ (`bda900d8-220f-4412-9227-a2e92219919b`)
  - `apps/web/src/components/dynamic/appearance/appearance-dialog.tsx`: Diálogo Apariencia
  - `apps/web/src/hooks/ui/use-apply-appearance.ts`: Aplica variables, fuentes y tamaño al documento
  - `apps/web/src/lib/appearance/fonts.ts`: Fuentes por categoría y carga desde Google Fonts
  - `apps/web/src/lib/appearance/themes.ts`: Temas de ER Studio más los de Agent Tracking

### Accesible y usable en móvil — 50%

ID: `308a7bc8-83d9-46e1-a443-745d4fef719d`

**Tipo:** No funcional, área experiencia de uso

Navegación con teclado, roles ARIA y diseño sin desplazamiento horizontal a 390 px.

**Definition of Done:**

- [x] Las pantallas principales no se desplazan en horizontal a 390 px (`5bc3a656-b647-4b4b-8b3c-b56a5eb6f1ee`)
- [ ] Los controles personalizados tienen rol, nombre accesible y funcionan con teclado (`cfcd7a51-c7a8-42d8-a0e1-1f135313f887`)

**Features:**

- Diseño adaptable y selector de proyectos — _done_ (`bc892359-fa8e-49bf-9e13-6d988fa6f21b`)
  - `apps/web/src/components/dynamic/project-switcher/project-switcher.tsx`: Cambiar de proyecto con Ctrl+K y teclado
  - `apps/web/src/components/ui/tabs/tabs.tsx`: Pestañas desplazables sin barra vertical

### La app se recupera sola de reinicios del servidor — 100%

ID: `38a44436-a323-49d5-a1ce-248c8dc01ad8`

**Tipo:** No funcional, área rendimiento

Peticiones con tiempo límite y reintentos, y recarga al reconectar el WebSocket.

**Definition of Done:**

- [x] Las lecturas se cortan a los 12 segundos y se reintentan (`8d2eeccb-f552-49bd-86bf-1163dfab18b5`)
- [x] Al reconectar el WebSocket se vuelven a pedir los datos (`0c6e5672-8b8a-425a-994d-f69689216c57`)

**Features:**

- Reintentos y recarga al reconectar — _done_ (`4e182ef9-9a67-474a-81f0-7b4b51e2a032`)
  - `apps/web/src/hooks/data/use-live-events.ts`: WebSocket que recarga todo al reconectar
  - `apps/web/src/lib/api.ts`: Llamadas para estado, instalación y compartir skills
  - `apps/web/src/lib/query-client.ts`: Reintentos para errores de red y del servidor

### Seguridad de rutas y datos locales — 100%

ID: `d9d9a456-5385-4793-918a-de1ab104db5e`

**Tipo:** No funcional, área seguridad

Nada se lee ni se escribe fuera del repo del proyecto, y nada sensible sale del equipo.

**Definition of Done:**

- [x] Las rutas de archivos se validan dentro del repo, incluidos los enlaces simbólicos (`b2e4892f-11a6-44eb-8eca-1c9b0cf5fc2b`)
- [x] Los worktrees pedidos se validan contra git worktree list (`d51c31d5-4301-404e-874d-487d4cbeca1e`)

**Features:**

- Validación de rutas y worktrees — _done_ (`229342a4-9fb9-48b6-9ad5-3532951f1d1b`)
  - `packages/git/src/repo.ts`: resolveRepoPath valida rutas dentro del repo siguiendo enlaces
  - `packages/server/src/repo-routes.ts`: checkoutOf solo acepta worktrees del repositorio

### Gestión de cambios y detección de conflictos — 0%

ID: `80d5080e-093a-4db8-8d2b-78e060067521`

**Tipo:** Funcional, área backend

Fase 6: solicitudes de cambio con análisis de conflictos y revisiones.

**Definition of Done:**

- [ ] Un cambio a requerimientos o reglas se crea como solicitud con reporte de conflictos (`5b995b43-b991-4536-97a8-5d34bc635787`)
- [ ] Al aprobar se guarda una revisión y los features afectados pasan a revisión (`7dff790a-a354-42a0-a94d-0d7fa28ff3c7`)

### Web multiusuario y colaboración — 0%

ID: `6512a2ba-bffe-4427-b835-b3740aa1fab3`

**Tipo:** Funcional, área infraestructura

Fases 7 y 8: PostgreSQL, autenticación, equipos, roles y presencia.

**Definition of Done:**

- [ ] Varias personas trabajan en el mismo proyecto con roles (`5f5fe41b-c0b7-44bf-a3dc-3a5d1fce84ee`)
- [ ] La app de escritorio puede sincronizar con un servidor compartido (`37358a45-94a4-4ac6-b55b-123d61637ac1`)

### Compartir el proyecto por git — 100%

ID: `e871c9a5-c03f-4fd2-a1e7-e2e2e6214af1`

**Tipo:** Funcional, área backend

Quien clona el repo importa el mismo proyecto, con sus imágenes y sus skills.

**Definition of Done:**

- [x] Al importar desde el repo se restauran las imágenes de referencia y de vistas (`74d018a8-c7c2-4168-807e-2858d433aa8b`)
- [x] Las skills personales se pueden incluir en el repo e instalar en otro equipo (`26607921-a38a-4a7f-a462-05c2c31e2f4b`)
- [x] Las skills de un plugin se instalan desde su marketplace con Claude Code (`99a6fe1e-cc88-4945-899b-f856e2c9f7bf`)

**Features:**

- Imágenes y skills que viajan con el repo — _done_ (`d112f799-8c92-465e-9c42-3cb4cb8ffceb`)
  - `apps/web/src/components/dynamic/project-detail/project-detail-skills.tsx`: Pestaña Skills con estado, instalar y compartir
  - `apps/web/src/hooks/data/use-skill-status.ts`: Consulta el estado y lanza instalar o compartir
  - `apps/web/src/lib/api.ts`: Llamadas para estado, instalación y compartir skills
  - `apps/web/src/lib/query-keys.ts`: Clave de consulta del estado de las skills
  - `packages/core/src/context.ts`: CONTEXT.md apunta a la copia compartida o al plugin de cada skill
  - `packages/core/src/core.test.ts`: Fixtures de skills con su origen
  - `packages/core/src/project-file.ts`: project.json guarda la lista de imágenes y el origen de cada skill
  - `packages/core/src/requirements.ts`: Ruta de la copia compartida de una skill en el repo
  - `packages/core/src/types.ts`: ProjectSkill con plugin, marketplace y compartida
  - `packages/db/src/migrations.gen.ts`: Migración con plugin, marketplace y compartida en las skills
  - `packages/db/src/schema.ts`: Columnas de origen y compartida en project_skills
  - `packages/server/src/app.ts`: Origen de las skills al crear el proyecto y casilla de compartir
  - `packages/server/src/portable.test.ts`: Test de un proyecto que pasa de un equipo a otro con imágenes y skills
  - `packages/server/src/skill-routes.ts`: Estado de las skills en este equipo e instalación
  - `packages/skills/src/index.ts`: Exporta las funciones para llevar skills entre equipos
  - `packages/skills/src/portable.ts`: Origen de las skills, copia al repo e instalación en otro equipo
  - `packages/tracking/src/repo-sync.ts`: Exporta skills compartidas y restaura imágenes al importar o sincronizar

## Ideas de tests pendientes

- Auditoría con teclado y lector de pantalla del wizard, el selector de proyectos y los diálogos (`573b8b64-4533-4f91-877b-02a2075b4602`)

## Cómo reportar tu trabajo

Este proyecto se rastrea vía el servidor MCP de Agent Tracking. Antes de empezar un feature llama a `start_feature`;
reporta cada archivo con `report_file`, sus funciones/variables con `report_symbol`, los tests con `report_test`
y marca los criterios del DoD con `mark_dod_item` cuando tengas evidencia. Al terminar llama a `complete_feature`.
Si se te ocurre un caso que valga la pena probar y no vas a escribirlo ahora, regístralo con `suggest_test_idea`.
