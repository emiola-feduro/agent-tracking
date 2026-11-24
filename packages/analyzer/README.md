# @agent-tracking/analyzer

Análisis estático del repositorio con [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web)
(WASM): símbolos de nivel superior y tests de cada archivo. Es una librería pura: no toca la base de
datos ni la UI. Lenguajes: TypeScript (`.ts .mts .cts`), TSX, JavaScript (`.js .mjs .cjs .jsx`) y
Python (`.py .pyi`).

## API

```ts
import { analyzeSource, analyzeFile, analyzeRepo, AnalysisCache } from "@agent-tracking/analyzer";

await analyzeSource("src/sum.test.ts", code);          // texto → FileAnalysis | null (lenguaje no soportado)
await analyzeFile(repoRoot, "src/sum.ts", cache?);     // archivo del repo (ruta validada dentro del repo)
await analyzeRepo(repoRoot, { cache, only? });         // repo completo → RepoAnalysis
```

- `FileAnalysis`: `{ path, language, hash, symbols, tests, imports, testKind, hasSyntaxErrors }`.
- `CodeSymbol`: `{ name, kind, startLine, endLine, exported, isDefault?, async?, private?, children? }`.
  `kind` ∈ `function | class | method | variable | constant | type | interface | enum`. Líneas 1-based e
  inclusivas; para declaraciones con decoradores o `export` el rango empieza en el decorador / `export`.
  Las clases traen sus métodos en `children`.
- `DetectedTest`: `{ name, file, line, endLine, framework, kind, skipped, parameterized }`.
- `RepoAnalysis`: `{ root, files, skipped, stats: { files, parsed, fromCache, symbols, tests, testsByKind, durationMs } }`.

`analyzeRepo` recorre lo que git rastrea o rastrearía (`git ls-files --cached --others --exclude-standard`),
así que respeta `.gitignore`; además omite siempre `.git`, `node_modules`, `dist`, `build`, `coverage`,
`vendor`, entornos virtuales de Python, archivos minificados y los mayores de 1 MB (`skipped` dice por qué).

**Incremental**: `AnalysisCache` guarda el resultado por ruta + sha256 del contenido; un archivo sin
cambios no se vuelve a parsear. Es serializable (`JSON.stringify(cache)` / `AnalysisCache.fromJSON(data)`)
para persistirla entre ejecuciones. Con `only: [...]` (por ejemplo, las rutas que entrega `watchRepo`
de `@agent-tracking/git`) se analizan solo esas rutas.

### Qué cuenta como exportado

- **TS/JS**: `export …`, `export default …`, `export { a, b as c }` (marca las declaraciones locales),
  y en CommonJS `module.exports = { a }`, `module.exports.x = …`, `exports.x = …`. Se reconocen
  también las declaraciones con desestructuración (`const { a, b: c } = …` declara `a` y `c`).
- **Python**: si el módulo define `__all__`, solo lo que aparece ahí; si no, todo nombre que no empiece
  por `_` (los dunder `__x__` cuentan como públicos). Las constantes son nombres en `MAYÚSCULAS`.
- **Métodos**: heredan el valor de su clase salvo los privados (`private`, `#x` o `_x` en Python),
  que llevan `private: true` y nunca son exportados.

## Detección de tests

Solo se buscan tests en **archivos de test**, para no confundir una función `test()` de la aplicación:

- **JS/TS**: ruta con `.test.`, `.spec.`, `.e2e.`, `.cy.`, `.it.` o `.integration.`, o dentro de
  `__tests__/`, `test/`, `tests/`, `e2e/`, `spec/`, `cypress/`, `playwright/`; o cualquier archivo que
  importe un framework de test (`vitest`, `bun:test`, `@jest/globals`, `@playwright/test`), lo que
  cubre los tests in-source.
- **Python**: `test_*.py` o `*_test.py` (la convención por defecto de pytest).

Casos reconocidos:

- **Vitest, Jest, Bun test, Mocha-like**: `describe/context/suite` son suites; `it/test/specify` son
  casos. El nombre completo une las suites con ` > ` (`Button > when clicked > increments`). Se
  reconocen `.only`, `.skip`, `.todo`, `.fixme`, `.concurrent`, `xit/xdescribe/fit`, y `.each(...)(...)`
  / `.for(...)` como parametrizados. Un caso necesita un título (literal, template o identificador) y
  una función; `.todo("x")` no necesita función. Un `skip` en una suite marca todos sus casos.
- **Playwright**: `test.describe(...)` es una suite; `test.beforeEach`, `test.step`, `test.use`,
  `test.extend`… no son tests, y `test.skip(condición, "motivo")` dentro de un test tampoco.
- **Pytest**: funciones `test*` de nivel superior y métodos `test*` de clases `Test*`; el nombre es el
  node id (`TestOrders::test_create`). `@pytest.mark.skip/skipif/xfail` → `skipped`;
  `@pytest.mark.parametrize` → `parameterized` (en la clase, se aplica a todos sus métodos).

**Framework**: se deduce de los imports (`vitest`, `bun:test`, `@jest/globals`, `@playwright/test`,
`@playwright/experimental-ct-*`); Python siempre es `pytest`. Si un archivo usa globales sin importar
nada, `analyzeRepo`/`analyzeFile` buscan el `package.json` más cercano subiendo hasta la raíz del
repo: `vitest` → vitest; `jest`, `ts-jest` o `@jest/globals` → jest; `@types/bun` o `bun-types` → bun.
Si no hay pistas queda `unknown`.

### Clasificación (unit, integration, e2e, component)

Se clasifica el **archivo** (todos sus tests comparten tipo). Las reglas se evalúan en orden y gana
la primera que coincide; `testKind.reason` explica cuál fue:

1. **Ruta**
   - carpeta `e2e`, `end-to-end`, `cypress`, `playwright` o `acceptance`, o archivo `*.e2e.*` / `*.cy.*` → **e2e**
   - carpeta `integration`, `integration-tests`, `integration_tests` o `it`, o archivo
     `*.integration.*`, `*.int.test.*`, `*.it.*`, `test_integration_*.py`, `*_integration_test.py` → **integration**
   - test `.tsx`/`.jsx` dentro de una carpeta `component(s)` → **component**
2. **Imports**
   - Playwright component testing, Testing Library, Vue Test Utils, Enzyme, `react-test-renderer`,
     `@storybook/test` → **component**
   - Cypress, Puppeteer, WebdriverIO, Selenium, `playwright`, `@playwright/test`, `pytest_playwright` → **e2e**
   - `supertest`, `testcontainers`, `msw/node`, `nock`, `fastapi.testclient`, `starlette.testclient`,
     `httpx`, `django.test`, `flask.testing`, `sqlalchemy`, `psycopg` → **integration**
3. **Framework**: Playwright (sin imports de componentes) → **e2e**
4. **Extensión**: un test en `.tsx`/`.jsx` → **component**
5. Si nada coincide → **unit**

La ruta va primero porque es la convención explícita del equipo (un test en `tests/integration/` que
usa Testing Library sigue siendo de integración). Son heurísticas: un archivo con varios tipos se
clasifica según la primera regla que aplique.

## WASM en Bun y en el sidecar compilado

`src/parser.ts` importa los `.wasm` (runtime de web-tree-sitter y gramáticas) con
`import x from "….wasm" with { type: "file" }`. Con `bun run` eso es la ruta en `node_modules`; con
`bun build --compile` (el sidecar de Tauri, `cd apps/desktop && bun run sidecar`) Bun embebe los
archivos y la ruta apunta a `$bunfs`. En ambos casos se leen con `Bun.file(path).bytes()` y se pasan a
`Parser.init({ wasmBinary })` y `Language.load(bytes)`, así que no se depende de `locateFile` ni de
archivos junto al binario. El runtime y cada gramática se cargan una sola vez, al primer uso.

## Tests

`bun test packages/analyzer`: fixtures por lenguaje en `fixtures/` (sin nombres `*.test.*` para que
`bun test` no los ejecute; se analizan con una ruta virtual) y un repo git temporal para
`analyzeRepo`/`analyzeFile`.
