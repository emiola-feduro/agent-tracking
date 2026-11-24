import { describe, expect, test } from "bun:test";
import {
  buildContextMarkdown,
  parseProjectFile,
  projectProgress,
  recommendStack,
  suggestDatabases,
  suggestTechnologies,
  STACK_OPTIONS,
  TECH_SUGGESTIONS,
  toggleStackOption,
  requirementProgress,
  serializeProjectFile,
  toPercent,
  toProjectFile,
  type ProjectSnapshot,
} from "./index";

const base = (): ProjectSnapshot => ({
  project: {
    id: "p1",
    name: "Tienda",
    goal: "Vender en línea",
    platforms: ["web", "mobile"],
    stack: ["SvelteKit", "Bun"],
    databases: ["PostgreSQL"],
    repoPath: null,
    repoUrl: null,
    createdAt: "",
    updatedAt: "",
  },
  rules: [
    { id: "b2", projectId: "p1", text: "Precios con IVA", priority: 2 },
    { id: "b1", projectId: "p1", text: "Todo pedido requiere login", priority: 1 },
  ],
  skills: [
    { id: "s1", projectId: "p1", name: "tdd", description: "Test first", source: "user", location: "", enabled: true },
    { id: "s2", projectId: "p1", name: "off", description: "x", source: "user", location: "", enabled: false },
  ],
  requirements: [
    { id: "r1", projectId: "p1", title: "Checkout", description: "", weight: 1 },
    { id: "r2", projectId: "p1", title: "Catálogo", description: "", weight: 3 },
  ],
  dod: [
    { id: "d1", requirementId: "r1", criterion: "Paga con tarjeta", origin: "human", status: "done", evidence: null },
    { id: "d2", requirementId: "r1", criterion: "Envía email", origin: "llm", status: "pending", evidence: null },
  ],
  features: [
    { id: "f1", requirementId: "r2", name: "Listado", description: "", status: "done", agent: null },
    { id: "f2", requirementId: "r2", name: "Filtros", description: "", status: "pending", agent: null },
  ],
  tests: [],
  files: [],
  featureFiles: [],
  symbols: [],
  testIdeas: [],
});

describe("progress", () => {
  test("requirement with DoD uses done/total criteria", () => {
    expect(toPercent(requirementProgress(base(), "r1"))).toBe(50);
  });

  test("requirement without DoD falls back to features", () => {
    expect(toPercent(requirementProgress(base(), "r2"))).toBe(50);
  });

  test("project is weighted average", () => {
    const s = base();
    s.features[1]!.status = "done"; // r2 → 100%
    // (0.5*1 + 1*3) / 4 = 0.875
    expect(toPercent(projectProgress(s))).toBe(88);
  });

  test("failing tests keep a done feature below 100%", () => {
    const s = base();
    s.features = [s.features[0]!];
    s.tests = [{ id: "t", featureId: "f1", requirementId: "r2", path: "a", name: "a", type: "unit", lastResult: "failing" }];
    expect(requirementProgress(s, "r2").ratio).toBeLessThan(1);
  });

  test("tests without a result do not lower a done feature", () => {
    const s = base();
    s.features = [s.features[0]!];
    s.tests = [
      { id: "t1", featureId: "f1", requirementId: "r2", path: "a", name: "a", type: "unit", lastResult: "passing" },
      { id: "t2", featureId: "f1", requirementId: "r2", path: "a", name: "b", type: "unit", lastResult: "unknown" },
      { id: "t3", featureId: "f1", requirementId: "r2", path: "a", name: "c", type: "unit", lastResult: "skipped" },
    ];
    expect(toPercent(requirementProgress(s, "r2"))).toBe(100);
  });

  test("empty project is 0%", () => {
    const s = base();
    s.requirements = [];
    expect(projectProgress(s).ratio).toBe(0);
  });
});

describe("context markdown", () => {
  const md = buildContextMarkdown(base());

  test("includes goal, stack and rules in priority order", () => {
    expect(md).toContain("Vender en línea");
    expect(md).toContain("SvelteKit, Bun");
    expect(md).toContain("Web, Móvil");
    expect(md.indexOf("requiere login")).toBeLessThan(md.indexOf("Precios con IVA"));
  });

  test("lists only enabled skills", () => {
    expect(md).toContain("**tdd**");
    expect(md).not.toContain("**off**");
  });

  test("renders DoD checkboxes with ids", () => {
    expect(md).toContain("- [x] Paga con tarjeta (`d1`)");
    expect(md).toContain("- [ ] Envía email (`d2`)");
  });
});

describe("project file", () => {
  test("round-trips through serialize and parse", () => {
    const s = base();
    s.project.repoPath = "/repo";
    s.skills[0]!.source = "repo";
    s.skills[0]!.location = "/repo/.claude/skills/tdd/SKILL.md";
    const file = toProjectFile(s);
    expect(file.skills[0]!.location).toBe(".claude/skills/tdd/SKILL.md");
    expect(file.requirements[0]!.dod.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(file.requirements[1]!.features.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(file.rules.map((r) => r.id)).toEqual(["b1", "b2"]);
    expect(JSON.stringify(file)).not.toContain("/repo\"");
    const parsed = parseProjectFile(serializeProjectFile(file));
    expect(parsed).toEqual({ ok: true, file });
  });

  test("carries files, symbols and test ideas", () => {
    const s = base();
    s.files = [
      { id: "fa", projectId: "p1", path: "src/list.ts", purpose: "Listado", changedAt: null, reportedAt: null, createdBy: "agent:x", createdAt: "", updatedAt: "" },
    ];
    s.featureFiles = [{ featureId: "f1", fileId: "fa" }];
    s.symbols = [
      { id: "y1", fileId: "fa", name: "list", kind: "function", lineStart: 1, lineEnd: 9, purpose: "", source: "reported" },
    ];
    s.testIdeas = [
      { id: "i1", projectId: "p1", featureId: "f1", requirementId: null, text: "Lista vacía", origin: "llm", status: "proposed", createdBy: "", createdAt: "" },
    ];
    const file = toProjectFile(s);
    expect(file.files[0]).toMatchObject({ path: "src/list.ts", featureIds: ["f1"], symbols: [{ name: "list" }] });
    expect(parseProjectFile(serializeProjectFile(file))).toEqual({ ok: true, file });
    const md = buildContextMarkdown(s);
    expect(md).toContain("`src/list.ts`: Listado");
    expect(md).toContain("Lista vacía (`i1`)");
  });

  test("accepts version 1 files written before files and test ideas existed", () => {
    const legacy = { version: 1, project: { id: "x", name: "Viejo" } };
    const parsed = parseProjectFile(JSON.stringify(legacy));
    expect(parsed.ok && parsed.file.files).toEqual([]);
    expect(parsed.ok && parsed.file.testIdeas).toEqual([]);
  });

  test("rejects invalid files with a readable error", () => {
    expect(parseProjectFile("{")).toEqual({ ok: false, error: "El archivo no es JSON válido" });
    const bad = parseProjectFile(JSON.stringify({ version: 1, project: { id: "x", name: "" } }));
    expect(bad.ok).toBe(false);
  });
});

describe("recommendStack", () => {
  test("only includes what the chosen platforms need", () => {
    const desktop = recommendStack(["desktop"]);
    expect(desktop.stack).toContain("Tauri");
    expect(desktop.stack).not.toContain("React Native");
    expect(desktop.stack).not.toContain("Hono");
    expect(desktop.databases).toEqual(["SQLite"]);

    const webMobile = recommendStack(["web", "mobile"]);
    expect(webMobile.stack).toEqual(expect.arrayContaining(["React", "React Native", "Bun", "Hono"]));
    expect(webMobile.stack).not.toContain("Tauri");
    expect(webMobile.alternatives.some((a) => a.stack.includes("Electron"))).toBe(false);

    expect(recommendStack(["mobile"]).stack).not.toContain("React");
    expect(recommendStack([]).stack).toEqual([]);
  });

  test("every recommendation is already consistent", () => {
    for (const platforms of [["web"], ["desktop"], ["mobile"], ["web", "desktop"], ["web", "mobile"], ["web", "desktop", "mobile"]] as const) {
      const rec = recommendStack([...platforms]);
      for (const option of [rec, ...rec.alternatives]) {
        // Re-adding each option must not drop anything.
        const rebuilt = option.stack.reduce<string[]>((acc, n) => (acc.includes(n) ? acc : toggleStackOption(acc, n)), []);
        expect(rebuilt.sort()).toEqual([...option.stack].sort());
      }
    }
  });
});

describe("toggleStackOption", () => {
  test("only one option per exclusive group", () => {
    expect(toggleStackOption(["Next.js", "Tailwind CSS"], "Angular").sort()).toEqual(["Angular", "Tailwind CSS"]);
    expect(toggleStackOption(["Bun"], "Node.js")).toEqual(["Node.js"]);
  });

  test("requirements are added and dependants removed with them", () => {
    expect(toggleStackOption([], "Expo").sort()).toEqual(["Expo", "React Native"]);
    expect(toggleStackOption(["React Native", "Expo"], "React Native")).toEqual([]);
    expect(toggleStackOption(["Bun", "Hono"], "FastAPI").sort()).toEqual(["FastAPI", "Python"]);
    expect(toggleStackOption(["FastAPI", "Python", "Pytest"], "Python")).toEqual([]);
  });

  test("native mobile and cross-platform frameworks exclude each other", () => {
    expect(toggleStackOption(["React Native", "Expo"], "SwiftUI").sort()).toEqual(["Swift", "SwiftUI"]);
    expect(toggleStackOption(["SwiftUI", "Swift", "Jetpack Compose", "Kotlin"], "Flutter").sort()).toEqual(["Dart", "Flutter", "Kotlin", "Swift"]);
  });

  test("free text entries just toggle", () => {
    expect(toggleStackOption(["React"], "GraphQL")).toEqual(["React", "GraphQL"]);
    expect(toggleStackOption(["React", "GraphQL"], "GraphQL")).toEqual(["React"]);
  });
});

describe("suggestDatabases", () => {
  test("matches names, aliases and kinds, prefix first", () => {
    expect(suggestDatabases("dyna", ["web"])[0]!.name).toBe("Amazon DynamoDB");
    expect(suggestDatabases("cosmos", ["web"]).map((d) => d.name)).toEqual(["Azure Cosmos DB"]);
    expect(suggestDatabases("vector", ["web"]).map((d) => d.name)).toContain("Qdrant");
    expect(suggestDatabases("neo", ["web"]).map((d) => d.name)).toEqual(expect.arrayContaining(["Neon", "Neo4j"]));
    expect(suggestDatabases("graf", ["web"]).map((d) => d.name)).toEqual(["Neo4j", "ArangoDB"]);
  });

  test("empty query suggests by platform and skips selected", () => {
    const mobile = suggestDatabases("", ["mobile"]).map((d) => d.name);
    expect(mobile).toContain("Realm");
    expect(mobile).not.toContain("Neo4j");
    expect(suggestDatabases("realm", ["mobile"], ["Realm"]).map((d) => d.name)).not.toContain("Realm");
  });
});

describe("suggestTechnologies", () => {
  test("search by name, alias and kind", () => {
    expect(suggestTechnologies("graph", ["web"], [])[0]!.name).toBe("GraphQL");
    expect(suggestTechnologies("react q", ["web"], []).map((t) => t.name)).toEqual(["TanStack Query"]);
    expect(suggestTechnologies("pagos", ["web"], []).map((t) => t.name)).toContain("Stripe");
    expect(suggestTechnologies("push", ["mobile"], []).map((t) => t.name)).toContain("OneSignal");
  });

  test("empty query follows the stack and platforms", () => {
    const flutter = suggestTechnologies("", ["mobile"], ["Flutter", "Dart"]).map((t) => t.name);
    expect(flutter.slice(0, 2).sort()).toEqual(["Bloc", "Riverpod"]);
    expect(flutter).not.toContain("Zustand");
    const react = suggestTechnologies("", ["web"], ["React", "TypeScript"]).map((t) => t.name);
    expect(react).toContain("TanStack Query");
    expect(react).not.toContain("Riverpod");
  });

  test("hides what is already in the stack and never repeats stack options", () => {
    expect(suggestTechnologies("graphql", ["web"], ["GraphQL"]).map((t) => t.name)).not.toContain("GraphQL");
    const names = new Set(STACK_OPTIONS.map((o) => o.name));
    expect(TECH_SUGGESTIONS.filter((t) => names.has(t.name))).toEqual([]);
  });
});
