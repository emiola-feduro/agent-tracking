import { loadSnapshot, openDb, schema as s } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { createRepoInference, createTracker, INFERRED_ACTOR } from "@agent-tracking/tracking";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRepoWatchers } from "./repo-watchers";

const CART = `export const TAX = 0.15;

export function addItem(items: string[], item: string) {
  return [...items, item];
}

export class Cart {
  total() {
    return 0;
  }
}
`;
const CART_TEST = `import { expect, test } from "bun:test";
import { addItem } from "./cart";

test("adds an item", () => {
  expect(addItem([], "a")).toEqual(["a"]);
});
`;

let tmp: string;
const dirs: string[] = [];

async function setup() {
  const repo = await mkdtemp(join(tmp, "repo-"));
  await git(["init", "-q", "-b", "main", repo]);
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "README.md"), "# demo\n");
  await git(["add", "-A"], repo);
  await git(["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init"], repo);

  const db = openDb(":memory:");
  const tracker = createTracker(db);
  const inference = createRepoInference(db, tracker);
  const projectId = "p1";
  await db.insert(s.projects).values({ id: projectId, name: "Demo", platforms: ["web"], repoPath: repo });
  await db.insert(s.requirements).values({ id: "r1", projectId, title: "Carrito" });
  return { repo, db, tracker, inference, projectId };
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-inference-"));
  dirs.push(tmp);
});
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

describe("repo inference", () => {
  test("uncommitted files become pending changes, and the final report organises them", async () => {
    const { repo, db, tracker, inference, projectId } = await setup();
    await writeFile(join(repo, "src/cart.ts"), CART);
    await writeFile(join(repo, "src/cart.test.ts"), CART_TEST);

    expect(await inference.syncWorkingTree(projectId)).toEqual({ analyzed: 2, removed: 0 });
    let snap = (await loadSnapshot(db, projectId))!;
    expect(snap.files.map((f) => f.path).sort()).toEqual(["src/cart.test.ts", "src/cart.ts"]);
    expect(snap.featureFiles).toEqual([]); // nothing is attributed until the agent reports
    const names = snap.symbols.map((x) => `${x.kind}:${x.name}`).sort();
    expect(names).toEqual(expect.arrayContaining(["class:Cart", "constant:TAX", "function:addItem"]));
    // The test file contributes its tests, not its helpers.
    const testFile = snap.files.find((f) => f.path === "src/cart.test.ts")!;
    expect(snap.symbols.filter((x) => x.fileId === testFile.id)).toEqual([]);
    expect(snap.tests).toMatchObject([{ name: "adds an item", type: "unit", featureId: null }]);
    expect((await tracker.pendingChanges(projectId)).map((p) => p.path).sort()).toEqual(["src/cart.test.ts", "src/cart.ts"]);

    const result = await tracker.submitReport(projectId, "agent:test", {
      summary: "Carrito",
      features: [
        {
          requirementId: "r1",
          name: "Agregar al carrito",
          files: [
            { path: "src/cart.ts", purpose: "Lógica del carrito", symbols: [{ name: "addItem", kind: "function", purpose: "Agrega" }] },
            { path: "src/cart.test.ts", purpose: "Tests del carrito" },
          ],
          tests: [{ path: "src/cart.test.ts", name: "adds an item", type: "unit", result: "passing" }],
        },
      ],
    });
    expect(result.pending).toEqual([]);
    expect(result.counts).toMatchObject({ features: 1, files: 2, symbols: 1, tests: 1 });
    snap = (await loadSnapshot(db, projectId))!;
    const feature = snap.features[0]!;
    expect(feature).toMatchObject({ name: "Agregar al carrito", status: "done" });
    expect(snap.featureFiles.filter((l) => l.featureId === feature.id)).toHaveLength(2);
    expect(snap.symbols.find((x) => x.name === "addItem")).toMatchObject({ source: "reported", purpose: "Agrega" });
    expect(snap.tests).toMatchObject([{ name: "adds an item", lastResult: "passing", featureId: feature.id, requirementId: "r1" }]);

    // A later edit makes the file pending again.
    await Bun.sleep(20);
    await writeFile(join(repo, "src/cart.ts"), CART + "\nexport const FREE_SHIPPING = 50;\n");
    await inference.syncPaths(projectId, ["src/cart.ts"]);
    expect((await tracker.pendingChanges(projectId)).map((p) => p.path)).toEqual(["src/cart.ts"]);
  });

  test("a report is validated before anything is written", async () => {
    const { db, tracker, projectId } = await setup();
    const bad = tracker.submitReport(projectId, "agent:test", {
      features: [
        { requirementId: "r1", name: "Bien", files: [{ path: "src/a.ts" }] },
        { requirementId: "no-existe", name: "Mal" },
      ],
    });
    expect(bad).rejects.toThrow("Requerimiento no encontrado");
    await bad.catch(() => {});
    expect((await loadSnapshot(db, projectId))!.features).toEqual([]);
    expect(tracker.submitReport(projectId, "agent:test", { features: [{ requirementId: "r1", name: "x", files: [{ path: "../fuera.ts" }] }] })).rejects.toThrow(
      "fuera del repositorio",
    );
    expect(tracker.submitReport(projectId, "agent:test", { features: [] })).rejects.toThrow("vacío");
  });

  test("a report is rejected with every path outside the repo and every unknown DoD id at once", async () => {
    const { db, tracker, projectId } = await setup();
    await db.insert(s.dodItems).values({ id: "d1", requirementId: "r1", criterion: "Agrega productos" });
    const bad = tracker.submitReport(projectId, "agent:test", {
      features: [
        {
          requirementId: "r1",
          name: "Carrito",
          files: [{ path: "src/a.ts" }, { path: "../fuera.ts" }, { path: "/etc/passwd" }],
          tests: [{ path: "../../t.test.ts", name: "t" }],
        },
      ],
      dod: [
        { id: "d1", status: "done" },
        { id: "no-existe", status: "done" },
      ],
    });
    const error = (await bad.catch((e: Error) => e)) as Error;
    expect(error.message).toContain("no se guardó");
    expect(error.message).toContain("../fuera.ts");
    expect(error.message).toContain("/etc/passwd");
    expect(error.message).toContain("../../t.test.ts");
    expect(error.message).toContain("Criterio del DoD no encontrado: no-existe");
    expect(error.message).not.toContain("src/a.ts");
    const snap = (await loadSnapshot(db, projectId))!;
    expect(snap.features).toEqual([]);
    expect(snap.dod.find((d) => d.id === "d1")!.status).toBe("pending");
  });

  test("a report warns about files that do not exist or did not change", async () => {
    const { repo, tracker, inference, projectId } = await setup();
    await writeFile(join(repo, "src/cart.ts"), CART);
    await inference.syncWorkingTree(projectId);
    const first = await tracker.submitReport(projectId, "agent:test", {
      features: [{ requirementId: "r1", name: "Carrito", files: [{ path: "src/cart.ts" }, { path: "src/fantasma.ts" }] }],
    });
    // The new file changed; the one that is not on disk is flagged.
    expect(first.warnings).toEqual(["src/fantasma.ts: no existe en el repositorio"]);

    // Committed and reported: reporting it again, untouched, is flagged; README was never touched either.
    await git(["add", "-A"], repo);
    await git(["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "cart"], repo);
    const again = await tracker.submitReport(projectId, "agent:test", {
      features: [{ requirementId: "r1", name: "Carrito", files: [{ path: "src/cart.ts" }, { path: "README.md" }] }],
    });
    expect(again.warnings.sort()).toEqual(["README.md: no cambió desde el último reporte", "src/cart.ts: no cambió desde el último reporte"]);

    // An edit after the last report is not flagged, even once committed.
    await Bun.sleep(20);
    await writeFile(join(repo, "README.md"), "# demo editado\n");
    await git(["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qam", "readme"], repo);
    const edited = await tracker.submitReport(projectId, "agent:test", {
      features: [{ requirementId: "r1", name: "Carrito", files: [{ path: "README.md" }] }],
    });
    expect(edited.warnings).toEqual([]);
  });

  test("what an agent reported is never overwritten, and stale inferred rows go away", async () => {
    const { repo, db, tracker, inference, projectId } = await setup();
    await writeFile(join(repo, "src/cart.ts"), CART);
    await tracker.reportSymbol(projectId, "agent:test", { path: "src/cart.ts", name: "addItem", kind: "function", purpose: "Agrega un producto" });
    await inference.syncPaths(projectId, ["src/cart.ts"]);

    let snap = (await loadSnapshot(db, projectId))!;
    const addItem = snap.symbols.find((x) => x.name === "addItem")!;
    expect(addItem).toMatchObject({ source: "reported", purpose: "Agrega un producto", lineStart: 3 });

    // Remove the class and rename the constant: inferred rows follow, the reported one stays.
    await writeFile(join(repo, "src/cart.ts"), CART.replace(/export class Cart[\s\S]*$/, "").replace("TAX", "VAT"));
    await inference.syncPaths(projectId, ["src/cart.ts"]);
    snap = (await loadSnapshot(db, projectId))!;
    expect(snap.symbols.map((x) => x.name).sort()).toEqual(["VAT", "addItem"]);

    // Deleting the file drops inferred symbols but keeps the file the agent reported.
    await rm(join(repo, "src/cart.ts"));
    await inference.syncPaths(projectId, ["src/cart.ts"]);
    snap = (await loadSnapshot(db, projectId))!;
    expect(snap.files.map((f) => f.path)).toEqual(["src/cart.ts"]);
    expect(snap.symbols.map((x) => x.name)).toEqual(["addItem"]);
  });

  test("an inferred file is removed with its tests when deleted; own files and other languages are ignored", async () => {
    const { repo, db, inference, projectId } = await setup();
    await writeFile(join(repo, "src/cart.test.ts"), CART_TEST);
    await writeFile(join(repo, "notes.txt"), "hola");
    await mkdir(join(repo, ".agent-tracking"), { recursive: true });
    await writeFile(join(repo, ".agent-tracking/x.ts"), "export const a = 1;");
    expect((await inference.syncPaths(projectId, ["src/cart.test.ts", "notes.txt", ".agent-tracking/x.ts"])).analyzed).toBe(1);
    await rm(join(repo, "src/cart.test.ts"));
    expect((await inference.syncPaths(projectId, ["src/cart.test.ts"])).removed).toBe(1);
    const snap = (await loadSnapshot(db, projectId))!;
    expect(snap.files).toEqual([]);
    expect(snap.tests).toEqual([]);
  });

  test("syncAll maps the whole repository without making it pending", async () => {
    const { repo, tracker, inference, projectId } = await setup();
    await writeFile(join(repo, "src/cart.ts"), CART);
    await git(["add", "-A"], repo);
    await git(["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "cart"], repo);
    expect((await inference.syncWorkingTree(projectId)).analyzed).toBe(0); // committed, nothing to look at
    expect((await inference.syncAll(projectId)).analyzed).toBe(1);
    expect(await tracker.pendingChanges(projectId)).toEqual([]);
  });
});

describe("repo watchers", () => {
  test("a file saved in the repo shows up without anyone reporting it", async () => {
    const { repo, db, tracker, inference, projectId } = await setup();
    const watchers = createRepoWatchers(db, inference, { debounceMs: 100 });
    try {
      expect(await watchers.startAll()).toBe(1);
      await writeFile(join(repo, "src/cart.ts"), CART);
      let snap = (await loadSnapshot(db, projectId))!;
      for (let i = 0; i < 50 && !snap.symbols.some((x) => x.name === "addItem"); i++) {
        await Bun.sleep(100);
        snap = (await loadSnapshot(db, projectId))!;
      }
      expect(snap.symbols.map((x) => x.name)).toContain("addItem");
      expect((await tracker.pendingChanges(projectId)).map((p) => p.path)).toEqual(["src/cart.ts"]);
      const events = await tracker.listEvents(projectId, { limit: 10 });
      expect(events.some((e) => e.type === "repo_changed" && e.actor === INFERRED_ACTOR)).toBe(true);

      // A project without a repo path stops being watched.
      await db.update(s.projects).set({ repoPath: null });
      await watchers.ensure(projectId);
      expect(watchers.size).toBe(0);
    } finally {
      watchers.closeAll();
    }
  });

  test("switching branch, even from a terminal, is noticed", async () => {
    const { repo, db, inference, projectId } = await setup();
    const switched: string[] = [];
    const watchers = createRepoWatchers(db, inference, { debounceMs: 100, onBranchChange: (id) => switched.push(id) });
    try {
      await watchers.startAll();
      await git(["checkout", "-q", "-b", "feature/gastos"], repo);
      for (let i = 0; i < 30 && switched.length === 0; i++) await Bun.sleep(100);
      expect(switched).toEqual([projectId]);
    } finally {
      watchers.closeAll();
    }
  });
});
