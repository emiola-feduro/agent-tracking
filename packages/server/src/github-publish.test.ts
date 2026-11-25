import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
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

/** A stand-in for the GitHub CLI: "creating" a repo makes a bare repository on disk and pushes to it. */
const FAKE_GH = `#!/usr/bin/env bash
set -e
if [ "$1" = "api" ] && [ "$2" = "user" ]; then echo "tester"; exit 0; fi
if [ "$1" = "api" ] && [ "$2" = "user/orgs" ]; then echo "acme"; exit 0; fi
if [ "$1" = "repo" ] && [ "$2" = "create" ]; then
  full="$3"; shift 3; src=""
  while [ $# -gt 0 ]; do case "$1" in --source) src="$2"; shift 2;; *) shift;; esac; done
  dest="$FAKE_GH_HOME/$full.git"
  if [ -d "$dest" ]; then echo "GraphQL: Name already exists on this account (createRepository)" >&2; exit 1; fi
  mkdir -p "$(dirname "$dest")"; git init -q --bare "$dest"
  git -C "$src" remote add origin "git@github.com:$full.git"
  git -C "$src" config "url.$dest.insteadOf" "git@github.com:$full.git"
  git -C "$src" push -q -u origin HEAD
  echo "https://github.com/$full"; exit 0
fi
echo "unknown $*" >&2; exit 1
`;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-gh-"));
  const bin = join(tmp, "gh");
  await writeFile(bin, FAKE_GH);
  await chmod(bin, 0o755);
  process.env.AGENT_TRACKING_GH = bin;
  process.env.FAKE_GH_HOME = join(tmp, "remote");
  app = createApp(openDb(":memory:"), { claudeHome: join(tmp, "claude") });
});
afterAll(async () => {
  delete process.env.AGENT_TRACKING_GH;
  await rm(tmp, { recursive: true, force: true });
});

describe("publishing to GitHub", () => {
  test("lists who can own the repo", async () => {
    expect((await call("GET", "/github/account")).data).toEqual({ ok: true, account: { login: "tester", orgs: ["acme"] } });
  });

  test("a brand-new repo gets a first commit, is created, connected and pushed", async () => {
    const path = join(tmp, "nuevo");
    await call("POST", "/import/init", { path });
    await git(["config", "user.email", "t@t"], path);
    await git(["config", "user.name", "t"], path);
    const { data: view } = await call("POST", "/projects", { name: "Nuevo", kind: "cli", repoPath: path, githubFiles: ["prTemplate"] });
    const res = await call("POST", `/projects/${view.project.id}/github/publish`, { owner: "acme", name: "nuevo", visibility: "private" });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ committed: true, pushed: true, repoUrl: "https://github.com/acme/nuevo" });
    expect((await call("GET", `/projects/${view.project.id}`)).data.project.repoUrl).toBe("https://github.com/acme/nuevo");
    const remoteLog = await git(["log", "--oneline", "--all"], join(tmp, "remote", "acme", "nuevo.git"));
    expect(remoteLog.stdout).toContain("Primer commit");

    // Already connected: nothing is created twice.
    const again = await call("POST", `/projects/${view.project.id}/github/publish`, { owner: "acme", name: "otro" });
    expect(again.status).toBe(409);
  });

  test("bad names and taken names are explained", async () => {
    const path = join(tmp, "dos");
    await call("POST", "/import/init", { path });
    await git(["config", "user.email", "t@t"], path);
    await git(["config", "user.name", "t"], path);
    const { data: view } = await call("POST", "/projects", { name: "Dos", kind: "cli", repoPath: path });
    expect((await call("POST", `/projects/${view.project.id}/github/publish`, { owner: "acme", name: "../x" })).status).toBe(400);
    const taken = await call("POST", `/projects/${view.project.id}/github/publish`, { owner: "acme", name: "nuevo" });
    expect(taken.data.error).toContain("Ya existe acme/nuevo");
  });
});
