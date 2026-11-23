import type { Node } from "web-tree-sitter";
import { stringValue } from "./symbols";
import type { DetectedTest, LanguageId, TestFramework, TestKind } from "./types";

const named = (n: Node) => n.namedChildren.filter((c): c is Node => c !== null);
const line = (n: Node) => ({ line: n.startPosition.row + 1, endLine: n.endPosition.row + 1 });

// ---------------------------------------------------------------------------------------------
// Which files can contain tests
// ---------------------------------------------------------------------------------------------

const JS_TEST_FILE = /(^|\/)(__tests__|tests?|e2e|spec|specs|cypress|playwright)\/|\.(test|spec|e2e|cy|it|integration)\.[cm]?[jt]sx?$/i;
const PY_TEST_FILE = /(^|\/)(test_[^/]*|[^/]*_test)\.py$/;

/** JS frameworks recognized from imports. */
const JS_FRAMEWORK_IMPORTS: [RegExp, TestFramework][] = [
  [/^@playwright\/(test|experimental-ct-)/, "playwright"],
  [/^vitest(\/|$)/, "vitest"],
  [/^bun:test$/, "bun"],
  [/^@jest\/globals$/, "jest"],
];

/** Is this a file whose tests we should report? Avoids treating an app function called `test()` as a test. */
export function isTestFile(path: string, language: LanguageId, imports: string[]): boolean {
  if (language === "python") return PY_TEST_FILE.test(path);
  return JS_TEST_FILE.test(path) || imports.some((i) => JS_FRAMEWORK_IMPORTS.some(([re]) => re.test(i)));
}

// ---------------------------------------------------------------------------------------------
// Framework and kind
// ---------------------------------------------------------------------------------------------

export function detectFramework(language: LanguageId, imports: string[], fallback: TestFramework = "unknown"): TestFramework {
  if (language === "python") return "pytest";
  for (const [re, fw] of JS_FRAMEWORK_IMPORTS) if (imports.some((i) => re.test(i))) return fw;
  return fallback;
}

const has = (imports: string[], ...patterns: RegExp[]) => imports.find((i) => patterns.some((p) => p.test(i)));
const segment = (path: string, ...names: string[]) => path.toLowerCase().split("/").slice(0, -1).find((s) => names.includes(s));

const E2E_IMPORTS = [/^cypress/, /^puppeteer/, /^webdriverio$/, /^@wdio\//, /^selenium-webdriver/, /^playwright$/, /^@playwright\/test$/, /^selenium(\.|$)/, /^splinter/, /^pytest_playwright/, /^playwright\.(sync|async)_api/];
const COMPONENT_IMPORTS = [/^@playwright\/experimental-ct-/, /^@testing-library\/(react|vue|svelte|preact|angular|solid|dom|user-event)/, /^@vue\/test-utils/, /^enzyme/, /^react-test-renderer/, /^@storybook\/test/];
const INTEGRATION_IMPORTS = [/^supertest/, /^testcontainers/, /^@testcontainers\//, /^msw\/node/, /^nock$/, /^fastapi\.testclient/, /^starlette\.testclient/, /^httpx$/, /^django\.test/, /^flask\.testing/, /^sqlalchemy/, /^psycopg/];

/**
 * Classifies a test file. Rules are evaluated in order and the first match wins (see README):
 *  1. Path: `e2e` dirs or `.e2e.`/`.cy.` files → e2e; `integration`/`it` dirs or `.integration.`/`.int.`/`.it.` → integration;
 *     `component(s)` test dirs → component.
 *  2. Imports: Playwright component testing / Testing Library / Vue Test Utils / Enzyme → component;
 *     Cypress / Puppeteer / WebdriverIO / Selenium / Playwright test runner → e2e;
 *     supertest / testcontainers / msw/node / nock / framework test clients / DB drivers → integration.
 *  3. Framework: Playwright (without component imports) → e2e.
 *  4. Extension: a `.tsx`/`.jsx` test file → component.
 *  5. Otherwise → unit.
 */
export function classifyTestFile(path: string, framework: TestFramework, imports: string[]): { kind: TestKind; reason: string } {
  const lower = path.toLowerCase();
  const file = lower.split("/").at(-1) ?? lower;

  const e2eDir = segment(lower, "e2e", "end-to-end", "cypress", "playwright", "acceptance");
  if (e2eDir) return { kind: "e2e", reason: `carpeta "${e2eDir}"` };
  if (/\.(e2e|cy)\.[a-z]+$/.test(file)) return { kind: "e2e", reason: "nombre de archivo .e2e/.cy" };
  const intDir = segment(lower, "integration", "integration-tests", "integration_tests", "it");
  if (intDir) return { kind: "integration", reason: `carpeta "${intDir}"` };
  if (/[._](integration|int|it)[._](test|spec)\.|\.(integration|int|it)\.[a-z]+$|^test_integration_|_integration_test\.py$/.test(file)) {
    return { kind: "integration", reason: "nombre de archivo de integración" };
  }
  if (segment(lower, "component", "components") && /\.(test|spec)\.[jt]sx$/.test(file)) {
    return { kind: "component", reason: "test .tsx/.jsx en carpeta de componentes" };
  }

  let imp: string | undefined;
  if ((imp = has(imports, ...COMPONENT_IMPORTS))) return { kind: "component", reason: `importa ${imp}` };
  if ((imp = has(imports, ...E2E_IMPORTS))) return { kind: "e2e", reason: `importa ${imp}` };
  if ((imp = has(imports, ...INTEGRATION_IMPORTS))) return { kind: "integration", reason: `importa ${imp}` };

  if (framework === "playwright") return { kind: "e2e", reason: "framework Playwright" };
  if (/\.[jt]sx$/.test(file)) return { kind: "component", reason: "test en archivo .tsx/.jsx" };
  return { kind: "unit", reason: "por defecto" };
}

// ---------------------------------------------------------------------------------------------
// JS: describe / it / test
// ---------------------------------------------------------------------------------------------

const SUITE = new Set(["describe", "context", "suite", "fdescribe", "xdescribe"]);
const CASE = new Set(["it", "test", "specify", "fit", "xit", "xtest"]);
const SKIP_MODIFIERS = new Set(["skip", "todo", "fixme"]);
const PLAYWRIGHT_NON_TESTS = new Set(["beforeEach", "afterEach", "beforeAll", "afterAll", "use", "step", "extend", "info", "setTimeout", "slow", "fail", "expect", "configure"]);

const FUNCTION_NODES = new Set(["arrow_function", "function_expression", "function"]);

type Callee ={ role: "suite" | "case"; skipped: boolean; parameterized: boolean };

/** Decodes `test`, `it.skip`, `describe.each(table)`, `test.describe.serial`, `test.concurrent.each(...)`, `xit`… */
function decodeCallee(fn: Node): Callee | null {
  let parameterized = false;
  let target = fn;
  // `test.each(table)` returns the function actually called with the name.
  if (target.type === "call_expression") {
    parameterized = true;
    target = target.childForFieldName("function") ?? target;
  }
  const parts: string[] = [];
  for (let n: Node | null = target; n; ) {
    if (n.type === "identifier") {
      parts.unshift(n.text);
      break;
    }
    if (n.type !== "member_expression") return null;
    parts.unshift(n.childForFieldName("property")?.text ?? "");
    n = n.childForFieldName("object");
  }
  const [head, ...mods] = parts;
  if (!head) return null;
  if (mods.some((m) => m === "each" || m === "for")) parameterized = true;
  const skipped = head.startsWith("x") || mods.some((m) => SKIP_MODIFIERS.has(m));
  if (SUITE.has(head)) return { role: "suite", skipped, parameterized };
  if (head === "test" && mods[0] === "describe") return { role: "suite", skipped, parameterized };
  if (head === "test" && mods.some((m) => PLAYWRIGHT_NON_TESTS.has(m))) return null;
  if (CASE.has(head)) return { role: "case", skipped, parameterized };
  return null;
}

function jsTests(root: Node, file: string, framework: TestFramework, kind: TestKind): DetectedTest[] {
  const out: DetectedTest[] = [];
  const visit = (node: Node, suites: string[], suiteSkipped: boolean) => {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      const callee = fn && decodeCallee(fn);
      const args = node.childForFieldName("arguments");
      const argList = args ? named(args) : [];
      const hasBody = argList.some((a) => FUNCTION_NODES.has(a.type));
      const first = argList[0];
      // Title: a string literal, or an identifier (`describe(MyClass, …)`); `test.skip(cond, "why")` has no body → ignored.
      const title =
        hasBody || callee?.skipped
          ? (stringValue(first) ?? (first && (first.type === "identifier" || first.type === "member_expression") && hasBody ? first.text : null))
          : null;
      if (callee && title !== null) {
        const skipped = suiteSkipped || callee.skipped;
        if (callee.role === "suite") {
          for (const child of named(args!)) visit(child, [...suites, title], skipped);
          return;
        }
        out.push({ name: [...suites, title].join(" > "), file, ...line(node), framework, kind, skipped, parameterized: callee.parameterized });
        return;
      }
    }
    for (const child of named(node)) visit(child, suites, suiteSkipped);
  };
  visit(root, [], false);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Python: pytest
// ---------------------------------------------------------------------------------------------

function decorators(n: Node): string[] {
  return n.type === "decorated_definition"
    ? named(n).filter((c) => c.type === "decorator").map((d) => d.text.slice(1))
    : [];
}

function pyTests(root: Node, file: string, kind: TestKind): DetectedTest[] {
  const out: DetectedTest[] = [];
  const flags = (decos: string[]) => ({
    skipped: decos.some((d) => /^pytest\.mark\.(skip|skipif|xfail)\b|^unittest\.skip/.test(d)),
    parameterized: decos.some((d) => /^pytest\.mark\.parametrize\b/.test(d)),
  });
  for (const stmt of named(root)) {
    const def = stmt.type === "decorated_definition" ? stmt.childForFieldName("definition") : stmt;
    const name = def?.childForFieldName("name")?.text;
    if (!def || !name) continue;
    const decos = decorators(stmt);
    if (def.type === "function_definition" && name.startsWith("test")) {
      out.push({ name, file, ...line(stmt), framework: "pytest", kind, ...flags(decos) });
    } else if (def.type === "class_definition" && name.startsWith("Test")) {
      const classFlags = flags(decos);
      for (const member of named(def.childForFieldName("body") ?? def)) {
        const m = member.type === "decorated_definition" ? member.childForFieldName("definition") : member;
        const mName = m?.childForFieldName("name")?.text;
        if (m?.type !== "function_definition" || !mName?.startsWith("test")) continue;
        const f = flags(decorators(member));
        out.push({
          name: `${name}::${mName}`, file, ...line(member), framework: "pytest", kind,
          skipped: classFlags.skipped || f.skipped, parameterized: classFlags.parameterized || f.parameterized,
        });
      }
    }
  }
  return out;
}

export type TestDetection = { tests: DetectedTest[]; testKind: { kind: TestKind; framework: TestFramework; reason: string } | null };

export function detectTests(
  root: Node,
  path: string,
  language: LanguageId,
  imports: string[],
  defaultFramework: TestFramework = "unknown",
): TestDetection {
  if (!isTestFile(path, language, imports)) return { tests: [], testKind: null };
  const framework = detectFramework(language, imports, defaultFramework);
  const { kind, reason } = classifyTestFile(path, framework, imports);
  const tests = language === "python" ? pyTests(root, path, kind) : jsTests(root, path, framework, kind);
  return { tests, testKind: tests.length ? { kind, framework, reason } : null };
}
