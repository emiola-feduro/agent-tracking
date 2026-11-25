import { INFERRED_ACTOR, PROJECT_FILE_PATH, toProjectFile } from "@agent-tracking/core";
import { loadSnapshot, openDb, schema as s } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRepoFile, syncRepoFiles, writeRepoFiles } from "./repo-sync";

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-repo-sync-"));
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const sh = async (cwd: string, ...args: string[]) => {
  const res = await git(["-c", "user.name=t", "-c", "user.email=t@t", ...args], cwd);
  return res;
};

/** A repository with a project of two requirements, written by Agent Tracking and committed. */
async function setup(name: string) {
  const repo = join(tmp, name);
  await git(["init", "-q", "-b", "main", repo]);
  const db = openDb(":memory:");
  await db.insert(s.projects).values({ id: `p-${name}`, name: "Tienda", platforms: ["web"], repoPath: repo });
  await db.insert(s.requirements).values([
    { id: "r1", projectId: `p-${name}`, title: "Pagos", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "r2", projectId: `p-${name}`, title: "Envíos", createdAt: "2026-01-02T00:00:00.000Z" },
  ]);
  await db.insert(s.dodItems).values([
    { id: "d1", requirementId: "r1", criterion: "Tarjeta", createdAt: "2026-01-01T00:00:01.000Z" },
    { id: "d2", requirementId: "r1", criterion: "Rechazos", createdAt: "2026-01-01T00:00:02.000Z" },
  ]);
  await writeRepoFiles(db, `p-${name}`);
  await sh(repo, "add", "-A");
  await sh(repo, "commit", "-qm", "init");
  return { repo, db, projectId: `p-${name}` };
}

const readJson = async (repo: string, path: string) => JSON.parse(await readFile(join(repo, path), "utf8"));
const editJson = async (repo: string, path: string, edit: (v: any) => void) => {
  const value = await readJson(repo, path);
  edit(value);
  await writeFile(join(repo, path), `${JSON.stringify(value, null, 2)}\n`);
};
const R1 = ".agent-tracking/requirements/r1.json";

describe("git merges of .agent-tracking", () => {
  test("the driver is registered and merges edits of the same requirement from two branches", async () => {
    const { repo } = await setup("merge");
    expect((await git(["config", "--get", "merge.agent-tracking.driver"], repo)).stdout).toContain("merge-driver.ts");
    expect(await readFile(join(repo, ".agent-tracking/.gitattributes"), "utf8")).toContain("*.json merge=agent-tracking");

    await sh(repo, "switch", "-q", "-c", "feat/dod");
    await editJson(repo, R1, (r) => {
      r.dod[0].status = "done";
      r.dod.push({ id: "d3", criterion: "Reembolsos", origin: "human", status: "pending", evidence: null, createdAt: "2026-01-01T00:00:09.000Z" });
    });
    await sh(repo, "commit", "-qam", "dod");

    await sh(repo, "switch", "-q", "main");
    // Adjacent lines of the same file: git's line merge would conflict here.
    await editJson(repo, R1, (r) => {
      r.title = "Pagos con tarjeta";
      r.dod[1].status = "failed";
    });
    await sh(repo, "commit", "-qam", "title");

    const merge = await sh(repo, "merge", "-q", "--no-edit", "feat/dod");
    expect(merge.ok).toBe(true);
    const r1 = await readJson(repo, R1);
    expect(r1.title).toBe("Pagos con tarjeta");
    expect(r1.dod.map((d: any) => [d.id, d.status])).toEqual([
      ["d1", "done"],
      ["d2", "failed"],
      ["d3", "pending"],
    ]);
  });

  test("the same value changed on both sides stops with conflict markers, as git does", async () => {
    const { repo } = await setup("conflict");
    await sh(repo, "switch", "-q", "-c", "other");
    await editJson(repo, R1, (r) => (r.title = "Cobros"));
    await sh(repo, "commit", "-qam", "theirs");
    await sh(repo, "switch", "-q", "main");
    await editJson(repo, R1, (r) => (r.title = "Pagos en línea"));
    await sh(repo, "commit", "-qam", "ours");
    const merge = await sh(repo, "merge", "-q", "--no-edit", "other");
    expect(merge.ok).toBe(false);
    expect(await readFile(join(repo, R1), "utf8")).toContain("<<<<<<< ours");
    await sh(repo, "merge", "--abort");
  });
});

describe("importing what arrives through git", () => {
  test("a pull is imported and the database's own unwritten changes are kept", async () => {
    const { repo, db, projectId } = await setup("pull");
    // Something the analysis found on this machine: it must survive the import.
    await db.insert(s.fileArtifacts).values({ id: "local-file", projectId, path: "src/x.ts", changedAt: "2026-02-01T00:00:00.000Z", createdBy: INFERRED_ACTOR });
    await db.insert(s.symbols).values({ id: "sym", fileId: "local-file", name: "x", kind: "function", source: "inferred", lineStart: 3, lineEnd: 9 });
    // A local change not written yet, then a pull that touches other things.
    await db.update(s.dodItems).set({ status: "done" }).where(eq(s.dodItems.id, "d1"));
    await editJson(repo, R1, (r) => (r.title = "Pagos con tarjeta"));
    await editJson(repo, PROJECT_FILE_PATH, (p) => p.rules.push({ id: "rule", text: "IVA incluido", priority: 1 }));
    await Bun.write(
      join(repo, ".agent-tracking/files/src/x.ts.json"),
      JSON.stringify({ path: "src/x.ts", purpose: "Calcula el IVA", createdBy: "agent:codex", featureIds: [], symbols: [] }),
    );

    const result = await syncRepoFiles(db, projectId);
    expect(result.status).toBe("imported");
    const snap = (await loadSnapshot(db, projectId))!;
    expect(snap.requirements.find((r) => r.id === "r1")!.title).toBe("Pagos con tarjeta");
    expect(snap.dod.find((d) => d.id === "d1")!.status).toBe("done");
    expect(snap.rules.map((r) => r.text)).toEqual(["IVA incluido"]);
    const file = snap.files.find((f) => f.path === "src/x.ts")!;
    expect(file).toMatchObject({ id: "local-file", purpose: "Calcula el IVA", changedAt: "2026-02-01T00:00:00.000Z" });
    expect(snap.symbols.find((y) => y.id === "sym")).toMatchObject({ lineStart: 3 });
    // And the files now carry both sides.
    const r1 = await readJson(repo, R1);
    expect([r1.title, r1.dod[0].status]).toEqual(["Pagos con tarjeta", "done"]);
    expect((await syncRepoFiles(db, projectId)).status).toBe("unchanged");
  });

  test("a checkout that removes a requirement removes it here too", async () => {
    const { repo, db, projectId } = await setup("checkout");
    await rm(join(repo, ".agent-tracking/requirements/r2.json"));
    expect((await syncRepoFiles(db, projectId)).status).toBe("imported");
    expect((await loadSnapshot(db, projectId))!.requirements.map((r) => r.id)).toEqual(["r1"]);
  });

  test("files with conflict markers are left alone until they are fixed", async () => {
    const { repo, db, projectId } = await setup("markers");
    const broken = "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs\n";
    await writeFile(join(repo, R1), broken);
    await db.update(s.requirements).set({ title: "Cambio local" }).where(eq(s.requirements.id, "r2"));
    const result = await syncRepoFiles(db, projectId);
    expect(result.status).toBe("invalid");
    expect(await readFile(join(repo, R1), "utf8")).toBe(broken);
    expect((await readJson(repo, ".agent-tracking/requirements/r2.json")).title).toBe("Envíos");
  });

  test("a version 1 project.json is read and rewritten in the new layout", async () => {
    const { repo, db, projectId } = await setup("v1");
    // Version 1 had no creation dates.
    const v1 = { ...toProjectFile((await loadSnapshot(db, projectId))!), version: 1 };
    v1.requirements = v1.requirements.map(({ createdAt: _c, ...r }) => r);
    await rm(join(repo, ".agent-tracking/requirements"), { recursive: true });
    await writeFile(join(repo, PROJECT_FILE_PATH), JSON.stringify(v1));
    const parsed = await readRepoFile(repo);
    expect(parsed?.ok && parsed.file.requirements.length).toBe(2);
    await writeRepoFiles(db, projectId);
    expect((await readJson(repo, PROJECT_FILE_PATH)).version).toBe(2);
    expect((await readJson(repo, R1)).dod).toHaveLength(2);
    const after = (await loadSnapshot(db, projectId))!;
    expect(after.requirements.map((r) => [r.title, r.createdAt])).toEqual([
      ["Pagos", "2026-01-01T00:00:00.000Z"],
      ["Envíos", "2026-01-02T00:00:00.000Z"],
    ]);
  });
});
