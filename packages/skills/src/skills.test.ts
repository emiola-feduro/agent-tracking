import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverCatalogSkills, discoverSkills, parseSkillFrontmatter, skillTemplate } from "./index";

let tmp: string;
const skill = async (dir: string, name: string, description: string) => {
  await mkdir(join(dir, name), { recursive: true });
  await writeFile(join(dir, name, "SKILL.md"), skillTemplate(name, description));
};

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "skills-"));
  await skill(join(tmp, "home", "skills"), "tdd", "Test first");
  await skill(join(tmp, "repo", ".claude", "skills"), "react-conventions", "Convenciones React");
  await skill(join(tmp, "home", "plugins", "cache", "acme", "skills"), "deploy", "Despliegue");
  await skill(join(tmp, "home", "plugins", "cache", "acme", "v2", "skills"), "deploy", "Despliegue");
  await skill(join(tmp, "home", "plugins", "marketplaces", "official", "lint", "skills"), "lint", "Lint");
  await mkdir(join(tmp, "home", "plugins", "cache", "acme", ".claude-plugin"), { recursive: true });
  await writeFile(join(tmp, "home", "plugins", "cache", "acme", ".claude-plugin", "plugin.json"), '{"name":"acme-tools"}');
  await mkdir(join(tmp, "home", "skills", "broken"), { recursive: true });
  await writeFile(join(tmp, "home", "skills", "broken", "SKILL.md"), "sin frontmatter");
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("parseSkillFrontmatter", () => {
  test("reads quoted multi-line descriptions", () => {
    const md = '---\nname: x\ndescription: "uno\\ndos"\n---\n# X';
    expect(parseSkillFrontmatter(md)).toEqual({ name: "x", description: "uno\ndos" });
  });
  test("returns null without name", () => {
    expect(parseSkillFrontmatter("---\ndescription: y\n---")).toBeNull();
  });
});

describe("discoverSkills", () => {
  test("finds user, repo and plugin skills; skips invalid", async () => {
    const found = await discoverSkills({ claudeHome: join(tmp, "home"), repoPath: join(tmp, "repo") });
    const byName = Object.fromEntries(found.map((s) => [s.name, s]));
    expect(Object.keys(byName).sort()).toEqual(["deploy", "react-conventions", "tdd"]);
    expect(byName.tdd!.source).toBe("user");
    expect(byName["react-conventions"]!.source).toBe("repo");
    expect(byName.deploy!.source).toBe("plugin");
    expect(found.filter((s) => s.name === "deploy").map((s) => s.plugin).sort()).toEqual(["acme-tools", "v2"]);
  });

  test("marketplace skills are catalog, not installed", async () => {
    const installed = await discoverSkills({ claudeHome: join(tmp, "home") });
    expect(installed.some((s) => s.name === "lint")).toBe(false);
    const catalog = await discoverCatalogSkills({ claudeHome: join(tmp, "home") });
    expect(catalog.map((s) => [s.name, s.source])).toEqual([["lint", "catalog"]]);
  });

  test("returns empty list when nothing is installed", async () => {
    expect(await discoverSkills({ claudeHome: join(tmp, "nope") })).toEqual([]);
  });
});
