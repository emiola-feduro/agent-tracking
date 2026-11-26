/**
 * Stops git commands that destroy shared history or work nobody can recover: deleting, renaming or
 * resetting the main branch, force pushes to it, orphan branches, `reset --hard` on it, `git clean -f`
 * and history rewrites. Agent Tracking answers the agents' PreToolUse hook with a denial and the
 * reason, so the agent sees why and can pick a safe way (a feat/ or fix/ branch, a normal commit).
 *
 * The parser is deliberately simple (whitespace and quotes): it looks for the dangerous shapes, it is
 * not a shell. Anything it does not recognise is allowed.
 */
export type GitGuardContext = {
  /** Branches nobody may delete, rename, reset or force-push (main, master and the remote's default). */
  protected: string[];
  /** Branch checked out where the command runs, if known. */
  current: string | null;
};

/** Splits on ;, &&, ||, | and new lines; keeps quoted text together and drops the quotes. */
function segments(command: string): string[][] {
  const out: string[][] = [];
  let words: string[] = [];
  let word = "";
  let quote: string | null = null;
  const endWord = () => {
    if (word) words.push(word);
    word = "";
  };
  const endSegment = () => {
    endWord();
    if (words.length) out.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "\n" || ch === ";" || ch === "|" || ch === "&" || ch === "(" || ch === ")") endSegment();
    else if (/\s/.test(ch)) endWord();
    else word += ch;
  }
  endSegment();
  return out;
}

/** `git [-C dir] [-c k=v] <sub> args…` inside a segment (after env assignments, sudo, etc.). */
function gitCall(words: string[]): { sub: string; args: string[] } | null {
  const at = words.findIndex((w) => w === "git" || w.endsWith("/git"));
  if (at < 0) return null;
  let i = at + 1;
  while (i < words.length && words[i]!.startsWith("-")) {
    // Options of git itself; -C and -c take a value.
    if (words[i] === "-C" || words[i] === "-c") i++;
    i++;
  }
  const sub = words[i];
  return sub ? { sub, args: words.slice(i + 1) } : null;
}

const has = (args: string[], ...flags: string[]) => args.some((a) => flags.includes(a));
/** Short flags can be combined (-fd, -Df): true when any of `letters` is in a short flag. */
const hasShort = (args: string[], letters: string) => args.some((a) => /^-[a-zA-Z]+$/.test(a) && [...letters].some((l) => a.includes(l)));
const positional = (args: string[]) => args.filter((a) => !a.startsWith("-"));

/** Branch name a refspec writes to: `main`, `HEAD:main`, `+x:refs/heads/main`, `:main`. */
const refTarget = (spec: string) => spec.replace(/^\+/, "").split(":").at(-1)!.replace(/^refs\/heads\//, "");

/** Reason to stop the command, or null when it is fine. */
export function gitGuard(command: string, ctx: GitGuardContext): string | null {
  const isProtected = (name: string | undefined | null) => !!name && ctx.protected.includes(name.replace(/^refs\/heads\//, "").replace(/^origin\//, ""));
  const names = ctx.protected.join(" o ");
  for (const words of segments(command)) {
    const call = gitCall(words);
    if (!call) continue;
    const { sub, args } = call;
    const pos = positional(args);
    switch (sub) {
      case "branch": {
        if ((has(args, "-d", "-D", "--delete") || hasShort(args, "dD")) && pos.some(isProtected)) {
          return `No se borra la rama ${names}: es la rama principal del proyecto. Trabaja en una rama feat/ o fix/.`;
        }
        if ((has(args, "-m", "-M", "--move") || hasShort(args, "mM")) && (pos.length === 1 ? isProtected(ctx.current) : isProtected(pos[0]))) {
          return `No se renombra la rama ${names}. Crea una rama nueva con git switch -c feat/<tema>.`;
        }
        if ((has(args, "-f", "--force") || hasShort(args, "f")) && isProtected(pos[0])) {
          return `No se mueve a la fuerza la rama ${names}.`;
        }
        break;
      }
      case "push": {
        if (has(args, "--mirror")) return "No se hace git push --mirror: reescribe todas las ramas del remoto.";
        const specs = pos.slice(1);
        if ((has(args, "--delete") || hasShort(args, "d")) && specs.some(isProtected)) {
          return `No se borra la rama ${names} del remoto.`;
        }
        if (specs.some((s) => s.startsWith(":") && isProtected(refTarget(s)))) return `No se borra la rama ${names} del remoto.`;
        const force = args.some((a) => a === "--force" || a.startsWith("--force-with-lease") || a === "--force-if-includes") || hasShort(args, "f") || specs.some((s) => s.startsWith("+"));
        const targets = specs.length ? specs.map(refTarget) : [ctx.current];
        if (force && targets.some(isProtected)) {
          return `No se hace push forzado a ${names}: reescribiría la historia que comparte el equipo. Sube tus cambios en una rama propia.`;
        }
        break;
      }
      case "checkout":
      case "switch": {
        if (has(args, "--orphan")) return "No se crean ramas huérfanas (--orphan): empiezan una historia aparte. Crea la rama desde la actual con git switch -c feat/<tema>.";
        const resetFlag = sub === "switch" ? ["-C", "--force-create"] : ["-B"];
        const i = args.findIndex((a) => resetFlag.includes(a));
        if (i >= 0 && isProtected(args[i + 1])) return `No se recrea la rama ${names}: perdería sus commits.`;
        break;
      }
      case "reset": {
        if (has(args, "--hard") && isProtected(ctx.current)) {
          return `No se hace git reset --hard en ${names}: borra commits y cambios sin guardar. Trabaja en una rama feat/ o fix/.`;
        }
        break;
      }
      case "update-ref": {
        if (pos.some(isProtected)) return `No se cambia ni borra la referencia de ${names} a mano.`;
        break;
      }
      case "clean": {
        if (has(args, "--force") || hasShort(args, "f")) {
          return "No se hace git clean -f: borra archivos sin seguimiento que no se pueden recuperar. Si sobra algo, bórralo por su nombre.";
        }
        break;
      }
      case "filter-branch":
      case "filter-repo":
        return "No se reescribe la historia del repositorio.";
    }
  }
  return null;
}
