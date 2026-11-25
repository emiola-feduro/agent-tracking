import { describe, expect, test } from "bun:test";
import { mergeJson } from "./json-merge";
import { PROJECT_FILE_PATH, type ProjectFile, projectFileSchema } from "./project-file";
import { isTrackingDataPath, joinProjectTree, splitProjectFile } from "./project-tree";

describe("mergeJson", () => {
  test("different fields of the same entry merge", () => {
    const base = { id: "r1", title: "Pago", weight: 1 };
    expect(mergeJson(base, { ...base, title: "Pago con tarjeta" }, { ...base, weight: 3 })).toEqual({
      ok: true,
      value: { id: "r1", title: "Pago con tarjeta", weight: 3 },
    });
  });

  test("entries are matched by id, path or name, whatever their position", () => {
    const base = { dod: [{ id: "a", status: "pending" }, { id: "b", status: "pending" }] };
    const ours = { dod: [{ id: "a", status: "done" }, { id: "b", status: "pending" }, { id: "c", status: "pending" }] };
    const theirs = { dod: [{ id: "b", status: "failed" }, { id: "a", status: "pending" }, { id: "d", status: "pending" }] };
    const result = mergeJson(base, ours, theirs);
    expect(result).toEqual({
      ok: true,
      value: {
        dod: [
          { id: "a", status: "done" },
          { id: "b", status: "failed" },
          { id: "c", status: "pending" },
          { id: "d", status: "pending" },
        ],
      },
    });
    const tests = mergeJson(
      { tests: [{ name: "x", lastResult: "unknown" }] },
      { tests: [{ name: "x", lastResult: "passing" }] },
      { tests: [{ name: "x", lastResult: "unknown" }, { name: "y", lastResult: "unknown" }] },
    );
    expect(tests).toEqual({ ok: true, value: { tests: [{ name: "x", lastResult: "passing" }, { name: "y", lastResult: "unknown" }] } });
  });

  test("lists of plain values merge as sets", () => {
    expect(mergeJson({ ids: ["a", "b"] }, { ids: ["a", "b", "c"] }, { ids: ["b"] })).toEqual({ ok: true, value: { ids: ["b", "c"] } });
  });

  test("removed on one side and untouched on the other goes away; edited on the other stays", () => {
    const base = { list: [{ id: "a", v: 1 }, { id: "b", v: 1 }] };
    const ours = { list: [{ id: "b", v: 1 }] };
    expect(mergeJson(base, ours, base)).toEqual({ ok: true, value: ours });
    expect(mergeJson(base, ours, { list: [{ id: "a", v: 2 }, { id: "b", v: 1 }] })).toEqual({
      ok: true,
      value: { list: [{ id: "b", v: 1 }, { id: "a", v: 2 }] },
    });
  });

  test("the same value changed differently is a conflict, unless a side is preferred", () => {
    const base = { title: "Pago" };
    expect(mergeJson(base, { title: "A" }, { title: "B" })).toEqual({ ok: false, path: "$.title" });
    expect(mergeJson(base, { title: "A" }, { title: "B" }, { prefer: "theirs" })).toEqual({ ok: true, value: { title: "B" } });
  });
});

const sample = (): ProjectFile =>
  projectFileSchema.parse({
    version: 2,
    project: { id: "p1", name: "Tienda" },
    rules: [{ id: "rule", text: "IVA incluido" }],
    requirements: [
      { id: "r2", title: "Envíos", createdAt: "2026-01-02T00:00:00.000Z" },
      {
        id: "r1",
        title: "Pagos",
        createdAt: "2026-01-01T00:00:00.000Z",
        dod: [
          { id: "d2", criterion: "Rechazos", createdAt: "2026-01-01T00:00:02.000Z" },
          { id: "d1", criterion: "Tarjeta", createdAt: "2026-01-01T00:00:01.000Z" },
        ],
        features: [{ id: "f1", name: "Checkout", createdAt: "2026-01-01T00:00:03.000Z" }],
      },
    ],
    tests: [
      { path: "src/pay.test.ts", name: "rechaza", featureId: "f1", lastResult: "passing" },
      { path: "src/pay.test.ts", name: "cobra", featureId: "f1" },
    ],
    files: [{ path: "src/pay.ts", purpose: "Cobro", featureIds: ["f1"], symbols: [{ name: "charge", kind: "function" }] }],
    attachments: [{ id: "a1b2c3d4-0000", filename: "Pantalla.png", requirementId: "r1" }],
  });

describe("project layout", () => {
  test("one file per requirement, code file, test file and image", () => {
    const tree = splitProjectFile(sample());
    expect([...tree.keys()].sort()).toEqual([
      ".agent-tracking/attachments/a1b2c3d4-pantalla.png.json",
      ".agent-tracking/files/src/pay.ts.json",
      PROJECT_FILE_PATH,
      ".agent-tracking/requirements/r1.json",
      ".agent-tracking/requirements/r2.json",
      ".agent-tracking/tests/src/pay.test.ts.json",
    ]);
    for (const path of tree.keys()) expect(isTrackingDataPath(path)).toBe(true);
    expect(isTrackingDataPath(".agent-tracking/attachments/a1b2c3d4-pantalla.png")).toBe(false);
    expect(isTrackingDataPath(".agent-tracking/CONTEXT.md")).toBe(false);
    // Stable order inside files: DoD by creation, tests by name.
    expect(JSON.parse(tree.get(".agent-tracking/requirements/r1.json")!).dod.map((d: { id: string }) => d.id)).toEqual(["d1", "d2"]);
    expect(JSON.parse(tree.get(".agent-tracking/tests/src/pay.test.ts.json")!).tests.map((t: { name: string }) => t.name)).toEqual(["cobra", "rechaza"]);
  });

  test("joining the files gives the project back, in a stable order", () => {
    const tree = splitProjectFile(sample());
    const joined = joinProjectTree(tree);
    if (!joined.ok) throw new Error(joined.error);
    expect(joined.file.requirements.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(joined.file.tests).toHaveLength(2);
    expect(joined.file.files[0]!.symbols[0]!.name).toBe("charge");
    // Writing it again gives the same bytes: no churn between machines.
    expect(splitProjectFile(joined.file)).toEqual(tree);
  });

  test("version 1 files (everything in project.json) are still read", () => {
    const v1 = { ...sample(), version: 1 };
    const joined = joinProjectTree(new Map([[PROJECT_FILE_PATH, JSON.stringify(v1)]]));
    expect(joined.ok && joined.file.requirements.length).toBe(2);
  });

  test("a broken data file is reported with its path", () => {
    const tree = splitProjectFile(sample());
    tree.set(".agent-tracking/requirements/r1.json", "<<<<<<< ours\n{}");
    expect(joinProjectTree(tree)).toEqual({ ok: false, error: ".agent-tracking/requirements/r1.json: el archivo no es JSON válido" });
  });
});
