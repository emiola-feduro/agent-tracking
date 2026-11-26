import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectStructure } from "./detect-structure";

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-detect-"));
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

const repo = async (name: string, files: Record<string, string>) => {
  const root = join(tmp, name);
  for (const [path, content] of Object.entries(files)) await Bun.write(join(root, path), content);
  return root;
};
const json = (v: unknown) => JSON.stringify(v);

describe("detectStructure", () => {
  test("bun workspaces with turbo: mobile, api and a shared library", async () => {
    const root = await repo("js", {
      "package.json": json({ private: true, workspaces: ["apps/*", "packages/*"] }),
      "bun.lock": "",
      "turbo.json": "{}",
      "apps/mobile/package.json": json({ dependencies: { expo: "1", "react-native": "1" }, devDependencies: { typescript: "5" } }),
      "apps/api/package.json": json({ dependencies: { hono: "4" } }),
      "apps/api/tsconfig.json": "{}",
      "packages/shared/package.json": json({}),
    });
    const found = await detectStructure(root);
    expect(found?.tool).toBe("turborepo");
    expect(found?.parts.map((p) => [p.path, p.kind, p.stack.join("+")])).toEqual([
      ["apps/api", "api", "TypeScript+Hono"],
      ["apps/mobile", "mobile", "TypeScript+React Native+Expo"],
      ["packages/shared", "library", "JavaScript"],
    ]);
  });

  test("a Dart workspace with a Flutter app for several platforms", async () => {
    const root = await repo("dart", {
      "pubspec.yaml": "name: w\nworkspace:\n  - apps/app\n  - packages/core\n",
      "apps/app/pubspec.yaml": "name: app\ndependencies:\n  flutter:\n    sdk: flutter\n",
      "apps/app/lib/main.dart": "",
      "apps/app/android/.keep": "",
      "apps/app/web/.keep": "",
      "packages/core/pubspec.yaml": "name: core\n",
    });
    const found = await detectStructure(root);
    expect(found?.tool).toBe("melos");
    expect(found?.parts.find((p) => p.path === "apps/app")).toMatchObject({ kind: "app", platforms: ["web", "mobile"], stack: ["Dart", "Flutter"] });
    expect(found?.parts.find((p) => p.path === "packages/core")?.kind).toBe("library");
  });

  test("Gradle, Cargo and go.work declarations", async () => {
    const gradle = await repo("gradle", {
      "settings.gradle.kts": 'rootProject.name = "x"\ninclude(":apps:android", ":apps:server")\n',
      "apps/android/build.gradle.kts": 'plugins { id("com.android.application"); kotlin("android") }\n',
      "apps/server/build.gradle.kts": 'plugins { id("org.springframework.boot"); kotlin("jvm") }\n',
    });
    expect((await detectStructure(gradle))?.parts.map((p) => p.kind)).toEqual(["mobile", "api"]);
    const cargo = await repo("cargo", { "Cargo.toml": '[workspace]\nmembers = ["crates/*"]\n', "crates/cli/Cargo.toml": "[package]\n", "crates/cli/src/main.rs": "" });
    expect((await detectStructure(cargo))?.parts[0]).toMatchObject({ kind: "cli", stack: ["Rust"] });
    const go = await repo("go", { "go.work": "go 1.22\n\nuse (\n\t./api\n)\n", "api/go.mod": "module x\nrequire github.com/gin-gonic/gin v1\n" });
    expect((await detectStructure(go))?.parts[0]).toMatchObject({ kind: "api", stack: ["Go", "Gin"], path: "api" });
  });

  test("without declarations, apps/* and packages/* with manifests; a plain repo is not a monorepo", async () => {
    const folders = await repo("folders", {
      "apps/web/package.json": json({ dependencies: { react: "19" } }),
      "services/ml/pyproject.toml": '[project]\ndependencies = ["fastapi"]\n',
    });
    expect(await detectStructure(folders)).toMatchObject({ tool: "folders", parts: [{ path: "apps/web" }, { path: "services/ml", stack: ["Python", "FastAPI"] }] });
    expect(await detectStructure(await repo("plain", { "package.json": json({ dependencies: { react: "19" } }) }))).toBeNull();
  });
});
