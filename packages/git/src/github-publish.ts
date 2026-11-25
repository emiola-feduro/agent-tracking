import { GitError } from "./repo";
import { git } from "./run";

/** The GitHub CLI binary; tests point it to a fake through AGENT_TRACKING_GH. */
const ghBin = () => process.env.AGENT_TRACKING_GH || "gh";

async function gh(args: string[], cwd?: string) {
  try {
    const proc = Bun.spawn([ghBin(), ...args], { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { ...process.env, GH_PROMPT_DISABLED: "1" } });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    return { ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch {
    return { ok: false, stdout: "", stderr: "missing" };
  }
}

export type GithubAccount = { login: string; orgs: string[] };

/** Who can own a new repository: the signed-in account and its organizations. null when gh is not usable. */
export async function githubAccount(): Promise<{ ok: true; account: GithubAccount } | { ok: false; reason: string }> {
  const user = await gh(["api", "user", "--jq", ".login"]);
  if (!user.ok) {
    return {
      ok: false,
      reason:
        user.stderr === "missing"
          ? "Instala GitHub CLI (gh) en este equipo para crear repositorios."
          : "Inicia sesión en GitHub CLI con `gh auth login` para crear repositorios.",
    };
  }
  const orgs = await gh(["api", "user/orgs", "--jq", ".[].login"]);
  return { ok: true, account: { login: user.stdout, orgs: orgs.ok ? orgs.stdout.split("\n").filter(Boolean) : [] } };
}

const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export type PublishInput = { owner: string; name: string; visibility: "private" | "public"; description?: string };
export type PublishResult = { url: string; committed: boolean; pushed: boolean };

/**
 * Creates a repository on GitHub for a local repo, connects it as `origin` and pushes the current
 * branch. A repo without commits gets a first one with what is there. Refuses repos that already have
 * an `origin`, so nothing existing is overwritten or redirected.
 */
export async function publishToGithub(root: string, input: PublishInput): Promise<PublishResult> {
  if (!NAME.test(input.owner) || !NAME.test(input.name) || input.name.startsWith(".")) {
    throw new GitError("Usa solo letras, números, puntos, guiones y guiones bajos en el nombre y la cuenta", "invalid_ref");
  }
  if ((await git(["remote", "get-url", "origin"], root)).ok) {
    throw new GitError("Este repositorio ya tiene un remoto origin; no se crea otro en GitHub", "dirty");
  }
  let committed = false;
  if (!(await git(["rev-parse", "--verify", "-q", "HEAD"], root)).ok) {
    await git(["add", "-A"], root);
    const commit = await git(["commit", "-q", "-m", "Primer commit, creado con Agent Tracking"], root);
    if (!commit.ok) {
      throw new GitError(
        /user\.(name|email)|identity/i.test(commit.stderr)
          ? "Git no sabe tu nombre o correo: configura user.name y user.email y vuelve a intentarlo"
          : commit.stderr.split("\n").at(-1) || "No se pudo hacer el primer commit",
        "git_failed",
      );
    }
    committed = true;
  }
  const args = ["repo", "create", `${input.owner}/${input.name}`, `--${input.visibility}`, "--source", root, "--remote", "origin", "--push"];
  if (input.description?.trim()) args.push("--description", input.description.trim().slice(0, 300));
  const created = await gh(args, root);
  if (!created.ok) {
    const message = created.stderr === "missing" ? "GitHub CLI (gh) no está instalado" : created.stderr.split("\n").filter(Boolean).at(-1) || "GitHub no creó el repositorio";
    throw new GitError(/already exists|Name already/i.test(message) ? `Ya existe ${input.owner}/${input.name} en GitHub` : message, "git_failed");
  }
  // The configured URL as written (get-url would apply insteadOf rewrites).
  const url = (await git(["config", "--get", "remote.origin.url"], root)).stdout;
  const pushed = (await git(["rev-parse", "--verify", "-q", "@{upstream}"], root)).ok;
  return { url, committed, pushed };
}
