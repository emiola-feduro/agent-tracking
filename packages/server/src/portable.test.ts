import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

/**
 * One person sets a project up with an image and two skills, pushes; another clones and imports.
 * Two apps with their own database and their own ~/.claude stand for the two machines.
 */
let tmp: string;
let origin: string;
let homeA: string;
let homeB: string;
let appA: ReturnType<typeof createApp>;
let appB: ReturnType<typeof createApp>;

const call = async (app: ReturnType<typeof createApp>, method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};
const run = async (args: string[], cwd: string) => {
  const r = await git(args, cwd);
  if (!r.ok) throw new Error(r.stderr);
  return r.stdout;
};
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7]);
const skillMd = (name: string) => `---\nname: ${name}\ndescription: Prueba\n---\n\n# ${name}\n`;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-port-"));
  origin = join(tmp, "a", "repo");
  homeA = join(tmp, "a", "claude");
  homeB = join(tmp, "b", "claude");
  await run(["init", "-q", "-b", "main", origin], tmp);
  await run(["config", "user.email", "t@t"], origin);
  await run(["config", "user.name", "t"], origin);
  // Machine A: a personal skill and a skill from a plugin of a known marketplace.
  await mkdir(join(homeA, "skills", "convenciones"), { recursive: true });
  await writeFile(join(homeA, "skills", "convenciones", "SKILL.md"), skillMd("convenciones"));
  await writeFile(join(homeA, "skills", "convenciones", ".env"), "SECRET=1");
  const pluginSkill = join(homeA, "plugins", "cache", "oficial", "buenas-practicas", "1.0.0", "skills", "tdd", "SKILL.md");
  await mkdir(join(pluginSkill, ".."), { recursive: true });
  await writeFile(pluginSkill, skillMd("tdd"));
  await writeFile(join(homeA, "plugins", "known_marketplaces.json"), JSON.stringify({ oficial: { source: { source: "github", repo: "acme/plugins" } } }));
  appA = createApp(openDb(":memory:"), { claudeHome: homeA });
  appB = createApp(openDb(":memory:"), { claudeHome: homeB });
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("a project travels with the repository", () => {
  test("images and skills arrive on the other machine", async () => {
    const created = await call(appA, "POST", "/projects", {
      name: "Viajero",
      kind: "api",
      repoPath: origin,
      requirements: [{ title: "Lista", dod: [{ criterion: "Como el mockup" }] }],
      skills: [
        { name: "convenciones", source: "user", location: join(homeA, "skills", "convenciones", "SKILL.md") },
        { name: "tdd", source: "plugin", location: join(homeA, "plugins", "cache", "oficial", "buenas-practicas", "1.0.0", "skills", "tdd", "SKILL.md") },
      ],
    });
    const id = created.data.project.id;
    const [own, plugin] = created.data.skills as any[];
    expect(plugin).toMatchObject({ plugin: "buenas-practicas", marketplace: "oficial", marketplaceSource: "acme/plugins" });

    // Share the personal skill; a plugin skill cannot be copied into the repo.
    expect((await call(appA, "PATCH", `/projects/${id}/skills/${own.id}`, { shared: true })).status).toBe(200);
    expect((await call(appA, "PATCH", `/projects/${id}/skills/${plugin.id}`, { shared: true })).status).toBe(400);
    expect(await Bun.file(join(origin, ".agent-tracking/skills/convenciones/SKILL.md")).exists()).toBe(true);
    expect(await Bun.file(join(origin, ".agent-tracking/skills/convenciones/.env")).exists()).toBe(false);
    // On the machine that has them, both count as installed.
    expect(((await call(appA, "GET", `/projects/${id}/skills/status`)).data as any[]).every((x) => x.installed)).toBe(true);

    const form = new FormData();
    form.set("file", new File([PNG], "mockup.png", { type: "image/png" }));
    form.set("dodItemId", created.data.dod[0].id);
    const image = (await (await appA.request(`/api/projects/${id}/attachments`, { method: "POST", body: form })).json()) as any;
    expect(await readFile(join(origin, ".agent-tracking/CONTEXT.md"), "utf8")).toContain(".agent-tracking/skills/convenciones/SKILL.md");

    // Push and clone.
    await run(["add", "."], origin);
    await run(["commit", "-qm", "proyecto"], origin);
    const clone = join(tmp, "b", "repo");
    await run(["clone", "-q", origin, clone], tmp);

    // Machine B does not have A's home folder.
    await rm(homeA, { recursive: true, force: true });
    const imported = await call(appB, "POST", "/import", { path: clone });
    expect(imported.status).toBe(201);
    expect(imported.data.attachments).toEqual([expect.objectContaining({ id: image.id, dodItemId: created.data.dod[0].id, mime: "image/png" })]);
    const bytes = new Uint8Array(await (await appB.request(`/api/attachments/${image.id}`)).arrayBuffer());
    expect(bytes).toEqual(PNG);
    // The import wrote the repo files again without removing the image.
    expect(await Bun.file(join(clone, `.agent-tracking/attachments/${image.id.slice(0, 8)}-mockup.png`)).exists()).toBe(true);

    const status = (await call(appB, "GET", `/projects/${id}/skills/status`)).data as any[];
    const byName = (n: string) => status.find((x) => x.skillId === imported.data.skills.find((k: any) => k.name === n).id);
    expect(byName("convenciones")).toMatchObject({ installed: false, install: "shared" });
    expect(byName("tdd")).toMatchObject({
      installed: false,
      install: "plugin",
      commands: ["claude plugin marketplace add acme/plugins", "claude plugin install buenas-practicas@oficial"],
    });

    const installed = await call(appB, "POST", `/projects/${id}/skills/${byName("convenciones").skillId}/install`);
    expect(installed.data).toMatchObject({ installed: true });
    expect(await readFile(join(homeB, "skills", "convenciones", "SKILL.md"), "utf8")).toContain("name: convenciones");
    // Never replaced afterwards.
    expect((await call(appB, "POST", `/projects/${id}/skills/${byName("convenciones").skillId}/install`)).data.installed).toBe(true);
  });
});
