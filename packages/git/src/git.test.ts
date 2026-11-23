import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneGithub, git, inspectRepo, parseGithubUrl, toHttpsUrl } from "./index";

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-git-"));
  await git(["init", "-q", "-b", "main", join(tmp, "repo")]);
  await git(["remote", "add", "origin", "git@github.com:acme/tienda.git"], join(tmp, "repo"));
  await mkdir(join(tmp, "repo", "src"));
  await mkdir(join(tmp, "plain"));
  await mkdir(join(tmp, "full"));
  await writeFile(join(tmp, "full", "x"), "x");
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

test("inspects a repo from a subdirectory", async () => {
  const info = await inspectRepo(join(tmp, "repo", "src"));
  expect(info).toMatchObject({ name: "repo", branch: "main", remoteUrl: "https://github.com/acme/tienda" });
});

test("non-repos and relative paths return null", async () => {
  expect(await inspectRepo(join(tmp, "plain"))).toBeNull();
  expect(await inspectRepo("relative/path")).toBeNull();
});

test("github url parsing", () => {
  expect(parseGithubUrl("https://github.com/acme/tienda.git")).toEqual({ owner: "acme", repo: "tienda" });
  expect(parseGithubUrl("https://evil.com/acme/tienda")).toBeNull();
  expect(parseGithubUrl("https://github.com/acme/tienda;rm -rf")).toBeNull();
  expect(toHttpsUrl("https://github.com/acme/tienda.git")).toBe("https://github.com/acme/tienda");
});

test("clone refuses bad urls and non-empty destinations", async () => {
  expect(cloneGithub("https://gitlab.com/a/b", join(tmp, "c"))).rejects.toThrow("github.com");
  expect(cloneGithub("https://github.com/a/b", join(tmp, "full"))).rejects.toThrow("no está vacía");
});
