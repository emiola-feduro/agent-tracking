<!-- agent-tracking:start (Agent Tracking mantiene este bloque; no lo edites a mano) -->
## Agent Tracking

Este proyecto se sigue con Agent Tracking. Antes de trabajar, lee `.agent-tracking/CONTEXT.md`: objetivo, reglas de negocio, requerimientos con su Definition of Done, convenciones de commits y ramas, y skills.

- Al empezar, llama a `get_project_context` del servidor MCP `agent-tracking`. Si no reconoce el proyecto, pásale `project` con la ruta de este repositorio.
- Al terminar, llama una vez a `submit_report` con lo que hiciste, por requerimiento y feature: archivos, funciones o tipos, tests y criterios del DoD cumplidos.
- Si cambiaste una vista de la app, guarda una captura y repórtala con `report_screen`.
- Háblale al usuario en español: tus respuestas, el resumen al terminar cada tarea y el `summary` de `submit_report`. El código y sus comentarios siguen las convenciones del proyecto.

### Git

- Antes de cambiar código, crea una rama desde la rama actual con `git switch -c <tipo>/<tema>` (por ejemplo `feat/exportar-csv`), salvo que ya estés en una rama de trabajo.
- Haz commits pequeños mientras avanzas y uno al terminar cada tarea, con el formato de estas convenciones. No dejes el trabajo sin commit.
- Nunca borres, renombres, recrees ni reescribas `main` o `master` (ni la rama principal del remoto): nada de `git branch -D`, `git push --force`, `git push --delete`, `git checkout --orphan` ni `git reset --hard` sobre ella.
- No uses `git clean -f`, `git filter-branch` ni comandos que descarten trabajo ajeno. Si algo sobra, bórralo por su nombre.
- No hagas push ni fusiones a main salvo que te lo pidan.
<!-- agent-tracking:end -->
