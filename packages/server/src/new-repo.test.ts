import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

let tmp: string;
let app: ReturnType<typeof createApp>;

const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-newrepo-"));
  app = createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("new repository from the wizard", () => {
  test("creates the folder with git on main, then the project writes its .github files", async () => {
    const path = join(tmp, "proyectos", "mis-gastos");
    const init = await call("POST", "/import/init", { path });
    expect(init.status).toBe(201);
    expect(init.data.repo).toMatchObject({ root: path, name: "mis-gastos", branch: "main" });
    expect(init.data.existingProjectId).toBeNull();

    const created = await call("POST", "/projects", {
      name: "Mis gastos",
      platforms: ["web"],
      stack: ["Bun", "Hono"],
      repoPath: path,
      githubFiles: ["ci", "prTemplate"],
      requirements: [{ title: "Registrar gastos" }],
    });
    expect(created.status).toBe(201);
    expect(await readFile(join(path, ".github/workflows/ci.yml"), "utf8")).toContain("bun test");
    expect(await readFile(join(path, ".github/pull_request_template.md"), "utf8")).toContain("- Registrar gastos");
    expect((await git(["symbolic-ref", "--short", "HEAD"], path)).stdout).toBe("main");
  });

  test("refuses folders with content and relative paths", async () => {
    const busy = join(tmp, "ocupada");
    await mkdir(busy);
    await writeFile(join(busy, "a.txt"), "x");
    expect(await call("POST", "/import/init", { path: busy })).toMatchObject({ status: 400, data: { error: expect.stringContaining("no está vacía") } });
    const repo = join(tmp, "repo");
    await git(["init", "-q", repo]);
    await writeFile(join(repo, "a.txt"), "x");
    expect((await call("POST", "/import/init", { path: repo })).data.error).toContain("Repositorio local");
    expect((await call("POST", "/import/init", { path: "relativa" })).status).toBe(400);
  });

  test("existing .github files in a repository are never replaced", async () => {
    const repo = join(tmp, "existente");
    await git(["init", "-q", "-b", "main", repo]);
    await mkdir(join(repo, ".github"), { recursive: true });
    await writeFile(join(repo, ".github/pull_request_template.md"), "mío");
    const created = await call("POST", "/projects", { name: "E", platforms: ["web"], repoPath: repo, githubFiles: ["ci", "prTemplate"] });
    expect(created.status).toBe(201);
    expect(await readFile(join(repo, ".github/pull_request_template.md"), "utf8")).toBe("mío");
    expect(await readFile(join(repo, ".github/workflows/ci.yml"), "utf8")).toContain("name: CI");
  });

  test("the pull request template is written as the person edited it", async () => {
    const repo = join(tmp, "plantilla");
    await git(["init", "-q", "-b", "main", repo]);
    const created = await call("POST", "/projects", {
      name: "P",
      kind: "api",
      repoPath: repo,
      githubFiles: ["prTemplate"],
      prTemplate: "## Cambios\n\n- [ ] Probado\n\n\n",
    });
    expect(created.status).toBe(201);
    expect(await readFile(join(repo, ".github/pull_request_template.md"), "utf8")).toBe("## Cambios\n\n- [ ] Probado\n");
  });
});

describe("kind of project", () => {
  test("an API needs no platforms; a full app does", async () => {
    const api = await call("POST", "/projects", { name: "API", kind: "api", stack: ["TypeScript", "Bun", "Hono"] });
    expect(api.status).toBe(201);
    expect(api.data.project).toMatchObject({ kind: "api", platforms: [] });

    const mobile = await call("POST", "/projects", { name: "M", kind: "mobile", platforms: ["web"] });
    expect(mobile.data.project.platforms).toEqual(["mobile"]);

    expect((await call("POST", "/projects", { name: "F", kind: "fullstack" })).status).toBe(400);
    expect((await call("POST", "/projects", { name: "F", platforms: ["web"] })).data.project.kind).toBe("fullstack");
  });

  test("the default recommendation follows the kind", async () => {
    const api = await call("GET", "/stack/recommend?kind=api");
    expect(api.data.stack).toContain("Hono");
    expect(api.data.stack).not.toContain("React");
    expect((await call("GET", "/stack/recommend?kind=nope")).status).toBe(400);
  });
});

describe("commit conventions", () => {
  test("are saved with the project and written into CONTEXT.md", async () => {
    const repo = join(tmp, "convenciones");
    await git(["init", "-q", "-b", "main", repo]);
    const created = await call("POST", "/projects", {
      name: "C",
      kind: "cli",
      repoPath: repo,
      commitConventions: { types: ["feat", "fix"], scope: "none", language: "es", custom: "Un commit por cambio lógico" },
    });
    expect(created.data.project.commitConventions).toMatchObject({ types: ["feat", "fix"], scope: "none" });
    const context = await readFile(join(repo, ".agent-tracking/CONTEXT.md"), "utf8");
    expect(context).toContain("## Convenciones de commits y ramas");
    expect(context).toContain("Un commit por cambio lógico");
    await call("PATCH", `/projects/${created.data.project.id}`, { commitConventions: null });
    expect(await readFile(join(repo, ".agent-tracking/CONTEXT.md"), "utf8")).toContain("por defecto");
  });
});
