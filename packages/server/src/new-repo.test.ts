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
});
