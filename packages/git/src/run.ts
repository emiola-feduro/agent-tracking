export type GitResult = { ok: boolean; stdout: string; stderr: string };

/** Runs git with an argument list (never through a shell). */
export async function git(args: string[], cwd?: string, timeoutMs = 120_000): Promise<GitResult> {
  const res = await gitRaw(args, cwd, timeoutMs);
  return { ok: res.ok, stdout: res.stdout.trim(), stderr: res.stderr };
}

/** Like `git` but keeps stdout untouched (needed for formats where leading spaces matter). */
export async function gitRaw(args: string[], cwd?: string, timeoutMs = 120_000): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    // Never block waiting for credentials in a background server.
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  return { ok: code === 0, stdout, stderr: stderr.trim() };
}

/** Tracked and untracked (not ignored) files, repo-relative POSIX paths. */
export async function listRepoFiles(root: string): Promise<string[]> {
  const res = await git(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"], root);
  if (!res.ok) throw new Error(res.stderr || "No se pudieron listar los archivos del repositorio");
  return res.stdout.split("\0").filter(Boolean).sort();
}
