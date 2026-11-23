import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AnalysisCache,
  analyzeFile,
  analyzeRepo,
  analyzeSource,
  classifyTestFile,
  detectLanguage,
  type CodeSymbol,
  type TestFramework,
} from "./index";

const FIXTURES = join(import.meta.dir, "..", "fixtures");
const fixture = (p: string) => Bun.file(join(FIXTURES, p)).text();
/** Analyzes a fixture as if it lived at `virtualPath` (fixtures avoid *.test.* names so bun does not run them). */
const analyze = async (p: string, virtualPath = p, defaultFramework?: TestFramework) =>
  (await analyzeSource(virtualPath, await fixture(p), { defaultFramework }))!;
const brief = (s: CodeSymbol) => [s.kind, s.name, s.exported, s.startLine, s.endLine];
const byName = (symbols: CodeSymbol[], name: string) => symbols.find((s) => s.name === name)!;

test("language detection", () => {
  expect(detectLanguage("a/b.ts")).toBe("typescript");
  expect(detectLanguage("a/b.TSX")).toBe("tsx");
  expect(detectLanguage("b.mjs")).toBe("javascript");
  expect(detectLanguage("b.jsx")).toBe("javascript");
  expect(detectLanguage("b.py")).toBe("python");
  expect(detectLanguage("b.rs")).toBeNull();
  expect(analyzeSource("x.md", "# hi")).resolves.toBeNull();
});

describe("TypeScript symbols", () => {
  test("top-level declarations with kinds, lines and export flags", async () => {
    const r = await analyze("typescript/symbols.ts");
    expect(r.language).toBe("typescript");
    expect(r.hasSyntaxErrors).toBe(false);
    expect(r.imports).toEqual(["node:fs/promises", "node:fs"]);
    expect(r.symbols.map(brief)).toEqual([
      ["interface", "User", true, 4, 6],
      ["type", "UserId", true, 8, 8],
      ["enum", "Role", true, 10, 13],
      ["constant", "MAX_USERS", true, 15, 15],
      ["variable", "counter", true, 16, 16],
      ["constant", "internalCache", false, 17, 17],
      ["function", "loadUser", true, 19, 21],
      ["function", "formatUser", true, 23, 23],
      ["function", "helper", false, 25, 27],
      ["class", "Repository", true, 29, 36],
      ["class", "Hidden", true, 38, 40], // exported via `export { Hidden as Visible }`
      ["function", "main", true, 44, 44],
    ]);
    expect(byName(r.symbols, "loadUser").async).toBe(true);
    expect(byName(r.symbols, "main").isDefault).toBe(true);
    expect(byName(r.symbols, "Repository").children!.map((c) => [c.name, c.kind, c.exported, c.async ?? false])).toEqual([
      ["find", "method", true, false],
      ["save", "method", true, true],
      ["onChange", "method", true, false],
    ]);
  });

  test("private members are never exported", async () => {
    const r = await analyzeSource("x.ts", "export class A {\n  private a() {}\n  #b() {}\n  c() {}\n}\n");
    expect(r!.symbols[0]!.children!.map((c) => [c.name, c.exported, c.private ?? false])).toEqual([
      ["a", false, true],
      ["#b", false, true],
      ["c", true, false],
    ]);
  });

  test("TSX components and default export by identifier", async () => {
    const r = await analyze("tsx/Button.tsx");
    expect(r.language).toBe("tsx");
    expect(r.hasSyntaxErrors).toBe(false);
    expect(r.symbols.map(brief)).toEqual([
      ["type", "Props", false, 3, 3],
      ["function", "Button", true, 5, 8],
      ["function", "Inner", true, 10, 10],
    ]);
    expect(byName(r.symbols, "Inner").isDefault).toBe(true);
  });
});

describe("JavaScript symbols", () => {
  test("CommonJS exports", async () => {
    const r = await analyze("javascript/legacy.cjs");
    expect(r.imports).toEqual(["node:path"]);
    expect(r.symbols.map(brief)).toEqual([
      ["constant", "path", false, 1, 1],
      ["function", "join", true, 3, 5],
      ["class", "Store", true, 7, 9],
      ["constant", "VERSION", false, 11, 11],
      ["function", "extra", true, 14, 14],
    ]);
    expect(byName(r.symbols, "Store").children!.map(brief)).toEqual([["method", "get", true, 8, 8]]);
  });

  test("ESM with JSX, generators, destructuring and dynamic imports", async () => {
    const r = await analyze("javascript/module.jsx");
    expect(r.hasSyntaxErrors).toBe(false);
    expect(r.imports).toEqual(["react", "./other", "./config.js"]);
    expect(r.symbols.map(brief)).toEqual([
      ["function", "App", true, 4, 4],
      ["function", "ids", true, 5, 5],
      ["variable", "legacy", false, 6, 6],
      ["constant", "a", false, 7, 7],
      ["constant", "renamed", false, 7, 7],
    ]);
  });
});

describe("Python symbols", () => {
  test("functions, classes with methods, constants and type aliases", async () => {
    const r = await analyze("python/models.py");
    expect(r.language).toBe("python");
    expect(r.imports).toEqual(["os.path", "dataclasses", ".base"]);
    expect(r.symbols.map(brief)).toEqual([
      ["constant", "MAX_ITEMS", true, 8, 8],
      ["variable", "_private_value", false, 9, 9],
      ["variable", "default_name", true, 10, 10],
      ["type", "Price", true, 12, 12],
      ["class", "Item", true, 15, 27], // starts at the decorator
      ["function", "make_item", true, 30, 31],
      ["function", "_load", false, 34, 35],
    ]);
    expect(byName(r.symbols, "Item").children!.map((c) => [c.name, c.exported, c.async ?? false])).toEqual([
      ["total", true, false],
      ["fetch", true, true],
      ["_internal", false, false],
    ]);
  });

  test("__all__ decides what is exported", async () => {
    const r = await analyze("python/with_all.py");
    expect(r.symbols.map((s) => [s.name, s.exported])).toEqual([
      ["public_one", true],
      ["public_two", false],
      ["_explicit", true],
    ]);
  });
});

describe("test detection", () => {
  test("Vitest + Testing Library in .tsx → component, nested describe names, skip and each", async () => {
    const r = await analyze("tsx/button-test.tsx", "src/Button.test.tsx");
    expect(r.testKind).toEqual({ kind: "component", framework: "vitest", reason: "importa @testing-library/react" });
    expect(r.tests.map((t) => [t.name, t.line, t.skipped, t.parameterized])).toEqual([
      ["Button > renders the label", 6, false, false],
      ["Button > when clicked > increments", 12, true, false],
      ["Button > handles %i clicks", 15, false, true],
    ]);
    expect(r.tests[0]).toMatchObject({ file: "src/Button.test.tsx", framework: "vitest", kind: "component", endLine: 9 });
  });

  test("Jest globals take the framework from package.json; supertest → integration", async () => {
    const r = await analyze("javascript/math-spec.js", "src/math.spec.js", "jest");
    expect(r.testKind).toMatchObject({ kind: "integration", framework: "jest" });
    expect(r.tests.map((t) => [t.name, t.skipped])).toEqual([
      ["math > adds", false],
      ["math > skipped one", true],
      ["math > later", true],
      ["top level", false],
    ]);
  });

  test("Playwright: test.describe is a suite; hooks, steps and conditional skips are not tests", async () => {
    const r = await analyze("typescript/e2e-flow.ts", "tests/checkout.spec.ts");
    expect(r.testKind).toMatchObject({ kind: "e2e", framework: "playwright" });
    expect(r.tests.map((t) => [t.name, t.line])).toEqual([["checkout > pays with card", 8]]);
  });

  test("Bun test with template titles; in-source tests detected via framework import", async () => {
    const r = await analyze("typescript/bun-case.ts", "src/api.ts");
    expect(r.testKind).toMatchObject({ kind: "unit", framework: "bun" });
    expect(r.tests.map((t) => t.name)).toEqual(["api > returns ${200}"]);
  });

  test("functions named test in non-test files are not tests", async () => {
    const r = await analyzeSource("src/util.ts", 'function test(name: string, fn: () => void) {}\ntest("x", () => {});\n');
    expect(r!.tests).toEqual([]);
    expect(r!.testKind).toBeNull();
  });

  test("pytest functions and Test* classes, only in test_*.py / *_test.py", async () => {
    const r = await analyze("python/pytest_cases.py", "tests/test_orders.py");
    expect(r.testKind).toEqual({ kind: "integration", framework: "pytest", reason: "importa fastapi.testclient" });
    expect(r.tests.map((t) => [t.name, t.line, t.skipped, t.parameterized])).toEqual([
      ["test_simple", 5, false, false],
      ["test_param", 9, false, true],
      ["test_skipped", 14, true, false],
      ["TestOrders::test_create", 24, false, false],
      ["TestOrders::test_cancel", 27, true, false],
    ]);
    expect((await analyze("python/pytest_cases.py", "app/orders.py")).tests).toEqual([]);
  });
});

describe("test classification heuristics", () => {
  const kind = (path: string, framework: TestFramework = "vitest", imports: string[] = []) => classifyTestFile(path, framework, imports).kind;
  test("path markers win", () => {
    expect(kind("e2e/login.spec.ts")).toBe("e2e");
    expect(kind("cypress/e2e/login.cy.ts")).toBe("e2e");
    expect(kind("src/login.e2e.ts")).toBe("e2e");
    expect(kind("tests/integration/db.test.ts", "vitest", ["@testing-library/react"])).toBe("integration");
    expect(kind("src/db.integration.test.ts")).toBe("integration");
    expect(kind("tests/integration/test_db.py", "pytest")).toBe("integration");
    expect(kind("src/components/Card.test.tsx")).toBe("component");
  });
  test("then imports, framework and extension", () => {
    expect(kind("src/a.test.ts", "vitest", ["@vue/test-utils"])).toBe("component");
    expect(kind("tests/ct.spec.tsx", "playwright", ["@playwright/experimental-ct-react"])).toBe("component");
    expect(kind("src/a.test.ts", "jest", ["puppeteer"])).toBe("e2e");
    expect(kind("src/a.test.ts", "jest", ["testcontainers"])).toBe("integration");
    expect(kind("tests/test_api.py", "pytest", ["httpx"])).toBe("integration");
    expect(kind("tests/flow.spec.ts", "playwright")).toBe("e2e");
    expect(kind("src/Widget.test.tsx")).toBe("component");
    expect(kind("src/sum.test.ts")).toBe("unit");
    expect(kind("tests/test_sum.py", "pytest")).toBe("unit");
  });
});

describe("repository analysis", () => {
  let tmp: string;
  let repo: string;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), "at-analyzer-"));
    repo = join(tmp, "repo");
    await git(["init", "-q", "-b", "main", repo]);
    await mkdir(join(repo, "src"), { recursive: true });
    await mkdir(join(repo, "web", "src"), { recursive: true });
    await mkdir(join(repo, "tests"), { recursive: true });
    await cp(join(FIXTURES, "typescript", "symbols.ts"), join(repo, "src", "symbols.ts"));
    await cp(join(FIXTURES, "python", "models.py"), join(repo, "src", "models.py"));
    await cp(join(FIXTURES, "python", "pytest_cases.py"), join(repo, "tests", "test_orders.py"));
    await cp(join(FIXTURES, "javascript", "math-spec.js"), join(repo, "web", "src", "math.spec.js"));
    await writeFile(join(repo, "web", "package.json"), JSON.stringify({ devDependencies: { vitest: "^3" } }));
    await writeFile(join(repo, ".gitignore"), "generated/\n");
    await mkdir(join(repo, "generated"));
    await writeFile(join(repo, "generated", "big.ts"), "export const x = 1;\n");
    await mkdir(join(repo, "node_modules", "dep"), { recursive: true });
    await writeFile(join(repo, "node_modules", "dep", "index.js"), "module.exports = 1;\n");
    await writeFile(join(repo, "README.md"), "# repo\n");
  });
  afterAll(() => rm(tmp, { recursive: true, force: true }));

  test("analyzes supported files, honoring .gitignore", async () => {
    const r = await analyzeRepo(repo);
    expect(r.files.map((f) => f.path)).toEqual(["src/models.py", "src/symbols.ts", "tests/test_orders.py", "web/src/math.spec.js"]);
    expect(r.stats).toMatchObject({ files: 4, parsed: 4, fromCache: 0, tests: 9, testsByKind: { unit: 0, integration: 9, e2e: 0, component: 0 } });
    // Globals-only test file: framework from the nearest package.json.
    expect(r.files[3]!.testKind).toMatchObject({ framework: "vitest", kind: "integration" });
  });

  test("incremental: unchanged files come from the cache, changed ones are re-parsed", async () => {
    const cache = new AnalysisCache();
    await analyzeRepo(repo, { cache });
    expect(cache.size).toBe(4);
    await writeFile(join(repo, "src", "extra.ts"), "export function added() {}\n");
    const second = await analyzeRepo(repo, { cache: AnalysisCache.fromJSON(JSON.parse(JSON.stringify(cache))) });
    expect(second.stats).toMatchObject({ files: 5, parsed: 1, fromCache: 4 });
    expect(second.files.find((f) => f.path === "src/extra.ts")!.symbols.map((s) => s.name)).toEqual(["added"]);

    await rm(join(repo, "src", "extra.ts"));
    const third = await analyzeRepo(repo, { cache });
    expect(third.stats).toMatchObject({ files: 4, parsed: 0, fromCache: 4 });
    const only = await analyzeRepo(repo, { cache, only: ["src/models.py"] });
    expect(only.files.map((f) => f.path)).toEqual(["src/models.py"]);
  });

  test("single file analysis validates paths", async () => {
    const r = await analyzeFile(repo, "src/models.py");
    expect(r!.path).toBe("src/models.py");
    expect((await analyzeFile(repo, join(repo, "src", "symbols.ts")))!.symbols.length).toBe(12);
    expect(await analyzeFile(repo, "README.md")).toBeNull();
    expect(analyzeFile(repo, "../outside.ts")).rejects.toThrow("dentro del repositorio");
    expect(analyzeFile(repo, "src/missing.ts")).rejects.toThrow("No existe el archivo");
    expect(analyzeFile(tmp, "repo/src/models.py")).rejects.toThrow("no es un repositorio");
  });
});
