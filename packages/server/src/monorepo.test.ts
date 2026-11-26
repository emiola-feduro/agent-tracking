import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

let tmp: string;
let app: ReturnType<typeof createApp>;

const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, { method, headers: json ? { "Content-Type": "application/json" } : {}, body: json ? JSON.stringify(json) : undefined });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};

const parts = [
  { id: "m", name: "mobile", kind: "mobile", platforms: ["mobile"], path: "apps/mobile", stack: ["Dart", "Flutter"] },
  { id: "a", name: "api", kind: "api", platforms: [], path: "apps/api", stack: ["TypeScript", "Bun", "Hono"] },
  { id: "s", name: "shared", kind: "library", platforms: [], path: "packages/shared", stack: ["TypeScript"] },
];

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-mono-"));
  app = createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("monorepo projects", () => {
  test("created with its pieces, tool, tests and scaffolding; requirements point at pieces", async () => {
    const repo = join(tmp, "tienda");
    await git(["init", "-q", "-b", "main", repo]);
    await writeFile(join(repo, "README.md"), "# Mío\n");
    const { status, data } = await call("POST", "/projects", {
      name: "Tienda",
      kind: "fullstack",
      platforms: ["mobile"],
      stack: ["Dart", "Flutter", "TypeScript", "Bun", "Hono"],
      repoPath: repo,
      structure: "monorepo",
      parts,
      monorepoTool: "bun-workspaces",
      testTypes: ["unit", "integration", "e2e"],
      scaffold: true,
      requirements: [{ title: "Pagos", parts: ["m", "a", "ajena"], dod: [{ criterion: "Cobra" }] }],
    });
    expect(status).toBe(201);
    expect(data.project).toMatchObject({ structure: "monorepo", monorepoTool: "bun-workspaces", testTypes: ["unit", "integration", "e2e"] });
    expect(data.project.parts).toHaveLength(3);
    expect(data.requirements[0].parts).toEqual(["m", "a"]);
    // Scaffolding, without replacing what was there.
    expect(await readFile(join(repo, "README.md"), "utf8")).toBe("# Mío\n");
    expect(JSON.parse(await readFile(join(repo, "package.json"), "utf8")).workspaces).toEqual(["apps/api", "packages/shared"]);
    expect(await readFile(join(repo, "apps/mobile/pubspec.yaml"), "utf8")).toContain("sdk: flutter");
    expect(await Bun.file(join(repo, "apps/api/package.json")).exists()).toBe(true);
    // CONTEXT.md and the shared file carry the structure.
    const context = await readFile(join(repo, ".agent-tracking/CONTEXT.md"), "utf8");
    expect(context).toContain("## Estructura del repositorio");
    expect(context).toContain("**mobile** en `apps/mobile`");
    expect(context).toContain("**Piezas:** mobile (`apps/mobile`), api (`apps/api`)");
    expect(context).toContain("## Tests");
    expect(JSON.parse(await readFile(join(repo, ".agent-tracking/project.json"), "utf8")).project.parts).toHaveLength(3);

    // Editing a requirement's pieces keeps only pieces of the project.
    const reqId = data.requirements[0].id;
    const patched = await call("PATCH", `/projects/${data.project.id}/requirements/${reqId}`, { parts: ["s", "nope"] });
    expect(patched.status).toBe(200);
    expect((await call("GET", `/projects/${data.project.id}`)).data.requirements[0].parts).toEqual(["s"]);
  });

  test("invalid pieces are refused", async () => {
    const repo = join(tmp, "mala");
    await git(["init", "-q", "-b", "main", repo]);
    const { status, data } = await call("POST", "/projects", {
      name: "Mala",
      kind: "api",
      repoPath: repo,
      structure: "monorepo",
      parts: [{ id: "x", name: "x", kind: "api", path: "../fuera" }],
    });
    expect(status).toBe(400);
    expect(data.error).toContain("segmentos vacíos");
  });

  test("inspecting a repository proposes the pieces of an existing monorepo", async () => {
    const repo = join(tmp, "existente");
    await git(["init", "-q", "-b", "main", repo]);
    await Bun.write(join(repo, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }));
    await Bun.write(join(repo, "apps/web/package.json"), JSON.stringify({ dependencies: { react: "19" } }));
    await Bun.write(join(repo, "apps/api/package.json"), JSON.stringify({ dependencies: { express: "5" } }));
    const { data } = await call("POST", "/import/inspect", { path: repo });
    expect(data.structure.parts.map((p: any) => [p.path, p.kind])).toEqual([
      ["apps/api", "api"],
      ["apps/web", "frontend"],
    ]);
  });
});
