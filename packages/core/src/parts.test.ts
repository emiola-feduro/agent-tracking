import { describe, expect, test } from "bun:test";
import {
  defaultTestTypes,
  monorepoToolsFor,
  newPart,
  partsProblems,
  proposedTree,
  recommendMonorepoTool,
  scaffoldFiles,
  suggestPartPath,
  summarizeParts,
  type ProjectPart,
} from "./index";

const part = (p: Partial<ProjectPart> & Pick<ProjectPart, "name" | "kind" | "path">): ProjectPart => ({ id: p.name, platforms: [], stack: [], ...p });

const mobile = part({ name: "Móvil", kind: "mobile", path: "apps/mobile", platforms: ["mobile"], stack: ["Dart", "Flutter"] });
const api = part({ name: "API", kind: "api", path: "apps/api", stack: ["TypeScript", "Bun", "Hono"] });
const web = part({ name: "Panel", kind: "frontend", path: "apps/panel", platforms: ["web"], stack: ["TypeScript", "React"] });
const shared = part({ name: "Compartido", kind: "library", path: "packages/shared", stack: ["TypeScript"] });

describe("project parts", () => {
  test("new pieces get a name and a folder that are not taken", () => {
    const first = newPart("api");
    expect(first).toMatchObject({ name: "api", path: "apps/api" });
    expect(newPart("api", [first])).toMatchObject({ name: "api-2", path: "apps/api-2" });
    expect(suggestPartPath("library", "Utilidades Comunes")).toBe("packages/utilidades-comunes");
  });

  test("problems: names, folders that leave the repo or overlap, missing platforms", () => {
    expect(partsProblems([mobile, api])).toEqual([]);
    expect(partsProblems([])).toEqual(["Agrega al menos una pieza"]);
    const problems = partsProblems([
      part({ name: "a", kind: "api", path: "../fuera" }),
      part({ name: "A", kind: "api", path: "apps/x" }),
      part({ name: "b", kind: "api", path: "apps/x/y" }),
      part({ name: "c", kind: "app", path: "apps/c" }),
      part({ name: "d", kind: "api", path: ".agent-tracking/d" }),
    ]);
    expect(problems.join("\n")).toContain("segmentos vacíos, . ni ..");
    expect(problems.join("\n")).toContain("Hay dos piezas llamadas A");
    expect(problems.join("\n")).toContain("se cruza con la de otra pieza");
    expect(problems.join("\n")).toContain("c: elige al menos una plataforma");
    expect(problems.join("\n")).toContain("Agent Tracking o git");
  });

  test("the project as a whole: union of platforms and stacks, full app when there is a backend", () => {
    expect(summarizeParts([mobile, api, web])).toMatchObject({ kind: "fullstack", platforms: ["mobile", "web"] });
    expect(summarizeParts([mobile, web]).kind).toBe("app");
    expect(summarizeParts([api, shared]).kind).toBe("api");
    expect(summarizeParts([mobile, api]).stack).toEqual(["Dart", "Flutter", "TypeScript", "Bun", "Hono"]);
  });

  test("monorepo tools follow the languages of the pieces", () => {
    expect(recommendMonorepoTool([api, web])).toBe("bun-workspaces");
    expect(recommendMonorepoTool([web])).toBe("pnpm-workspaces");
    expect(recommendMonorepoTool([mobile])).toBe("melos");
    const ids = monorepoToolsFor([mobile, api]).map((t) => t.id);
    expect(ids).toContain("melos");
    expect(ids).toContain("turborepo");
    expect(ids).not.toContain("cargo");
    expect(ids.at(-1)).toBe("folders");
  });

  test("scaffolding: tool files, a README and a manifest per piece", () => {
    const files = scaffoldFiles({ name: "Tienda", structure: "monorepo", parts: [mobile, api, shared], tool: "bun-workspaces" });
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([
      "README.md",
      "apps/api/README.md",
      "apps/api/package.json",
      "apps/mobile/README.md",
      "apps/mobile/pubspec.yaml",
      "package.json",
      "packages/shared/README.md",
      "packages/shared/package.json",
    ]);
    expect(JSON.parse(files.find((f) => f.path === "package.json")!.content).workspaces).toEqual(["apps/api", "packages/shared"]);
    expect(files.find((f) => f.path === "apps/mobile/pubspec.yaml")!.content).toContain("sdk: flutter");
    expect(JSON.parse(files.find((f) => f.path === "apps/api/package.json")!.content).name).toBe("@tienda/api");
  });

  test("the main framework decides the manifest: Flutter with TypeScript also chosen is Dart", () => {
    const flutter = { ...mobile, stack: ["TypeScript", "Bun", "Dart", "Flutter"] };
    const files = scaffoldFiles({ name: "Tienda", structure: "monorepo", parts: [flutter, api], tool: "bun-workspaces" });
    expect(files.map((f) => f.path)).toContain("apps/mobile/pubspec.yaml");
    expect(JSON.parse(files.find((f) => f.path === "package.json")!.content).workspaces).toEqual(["apps/api"]);
  });

  test("a single app is scaffolded at the root", () => {
    const files = scaffoldFiles({ name: "Gastos", structure: "single", parts: [{ ...api, path: "." }], tool: null });
    expect(files.map((f) => f.path)).toEqual(["README.md", "package.json"]);
  });

  test("the proposed tree shows the folders, what each piece is and .agent-tracking", () => {
    const tree = proposedTree({ name: "Tienda", structure: "monorepo", parts: [mobile, api], tool: "turborepo" });
    expect(tree.split("\n")[0]).toBe("tienda/");
    expect(tree).toContain("├── apps/");
    expect(tree).toContain("mobile/  # Móvil: App móvil (Flutter)");
    expect(tree).toContain("├── .agent-tracking/  # contexto y datos de Agent Tracking");
    expect(tree).not.toContain("package.json  # package.json");
    expect(tree).toContain("turbo.json");
    expect(tree).toContain(".agent-tracking/");
  });
});

describe("test policy", () => {
  test("defaults follow the kind of project", () => {
    expect(defaultTestTypes("api")).toEqual(["unit", "integration"]);
    expect(defaultTestTypes("mobile")).toEqual(["unit", "component", "e2e"]);
    expect(defaultTestTypes("library")).toEqual(["unit"]);
  });
});
