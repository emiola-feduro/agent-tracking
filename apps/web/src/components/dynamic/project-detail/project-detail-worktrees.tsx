import { useState } from "react";
import Button from "@/components/ui/button/button";
import DiffView from "@/components/ui/diff-view/diff-view";
import Skeleton from "@/components/ui/skeleton/skeleton";
import StatusPill from "@/components/ui/status-pill/status-pill";
import { useAgentTurns } from "@/hooks/data/use-agent-turns";
import { useCheckout, useLocalBranches, useWorktreeDiff, useWorktrees } from "@/hooks/data/use-worktrees";
import type { Worktree } from "@/lib/api";
import { formatRelative } from "@/lib/activity";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortPath = (path: string) => path.replace(/^\/home\/[^/]+|^\/Users\/[^/]+/, "~");

const WorktreeCard = ({ projectId, worktree, base }: { projectId: string; worktree: Worktree; base: string | null }) => {
  const [showDiff, setShowDiff] = useState(false);
  const diff = useWorktreeDiff(projectId, showDiff ? worktree.path : null);
  const { data: turns } = useAgentTurns(projectId);
  const lastTurn = (turns ?? []).find((t) => t.cwd === worktree.path || t.cwd.startsWith(`${worktree.path}/`));
  const p = worktree.progress;
  const isBase = worktree.branch === base;

  return (
    <li className="flex animate-enter flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-mono text-[0.8125rem] text-brand">{worktree.branch ?? "HEAD separado"}</span>
            {worktree.main && <StatusPill>Checkout principal</StatusPill>}
            {worktree.locked && <StatusPill tone="warn">Bloqueado</StatusPill>}
            {worktree.prunable && <StatusPill tone="danger">La carpeta ya no existe</StatusPill>}
          </div>
          <code className="truncate font-mono text-xs text-muted" title={worktree.path}>
            {shortPath(worktree.path)}
          </code>
        </div>
        {p && (p.files > 0 || p.dirty > 0) && (
          <Button size="sm" variant={showDiff ? "secondary" : "ghost"} onClick={() => setShowDiff(!showDiff)}>
            {showDiff ? "Ocultar cambios" : "Ver cambios"}
          </Button>
        )}
      </div>
      {p && (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">{isBase ? "Rama base" : `Frente a ${base ?? "la base"}`}</dt>
            <dd className="text-ink">{isBase ? "Es la base" : `${plural(p.ahead, "commit", "commits")} adelante${p.behind ? `, ${p.behind} atrás` : ""}`}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Sin commit</dt>
            <dd className={p.dirty ? "text-warn" : "text-ink"}>{p.dirty ? plural(p.dirty, "archivo", "archivos") : "Nada"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{isBase ? "Cambios sin commit" : "Cambios en total"}</dt>
            <dd className="font-mono text-ink tabular-nums">
              {p.files ? (
                <>
                  {p.files} arch. <span className="text-ok">+{p.insertions}</span> <span className="text-danger">-{p.deletions}</span>
                </>
              ) : (
                "Ninguno"
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">Último commit</dt>
            <dd className="truncate text-ink" title={p.lastCommit?.subject}>
              {p.lastCommit ? `${formatRelative(p.lastCommit.date)}: ${p.lastCommit.subject}` : "Sin commits"}
            </dd>
          </div>
        </dl>
      )}
      {lastTurn && (
        <p className="rounded-md bg-subtle px-3 py-2 text-sm text-ink-soft">
          <span className="font-medium text-ink">Último turno de un agente aquí</span>{" "}
          {lastTurn.endedAt ? `terminó ${formatRelative(lastTurn.endedAt)}` : "sigue en curso"}
          {lastTurn.prompt ? `: “${lastTurn.prompt.slice(0, 120)}${lastTurn.prompt.length > 120 ? "…" : ""}”` : "."}
        </p>
      )}
      {showDiff &&
        (diff.isPending ? (
          <Skeleton className="h-24" />
        ) : diff.isError ? (
          <p className="text-sm text-danger">{(diff.error as Error).message}</p>
        ) : (
          <DiffView patch={diff.data.patch} files={diff.data.files} truncated={diff.data.truncated} openUpTo={2} />
        ))}
    </li>
  );
};

/**
 * Every checkout of the repository (main and `git worktree add` ones) with what each agent's branch
 * holds compared to the base, plus the local branches to switch the main checkout to.
 */
const ProjectDetailWorktrees = ({ projectId }: { projectId: string }) => {
  const worktrees = useWorktrees(projectId);
  const branches = useLocalBranches(projectId);
  const checkout = useCheckout(projectId);
  const inWorktree = new Map((worktrees.data?.worktrees ?? []).filter((w) => !w.main && w.branch).map((w) => [w.branch!, w.path]));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-ink">Worktrees</h2>
          <Button size="sm" variant="ghost" onClick={() => (worktrees.refetch(), branches.refetch())}>
            Actualizar
          </Button>
        </div>
        <p className="-mt-2 text-sm text-muted">
          Cada agente puede trabajar en su propio worktree. Aquí ves lo que lleva cada uno respecto a{" "}
          <code className="font-mono">{worktrees.data?.base ?? "la rama base"}</code>, aunque no esté en la rama actual.
        </p>
        {worktrees.isPending && <Skeleton className="h-32" />}
        {worktrees.isError && <p className="text-sm text-danger">{(worktrees.error as Error).message}</p>}
        <ul className="flex flex-col gap-3">
          {worktrees.data?.worktrees.map((w) => (
            <WorktreeCard key={w.path} projectId={projectId} worktree={w} base={worktrees.data.base} />
          ))}
        </ul>
        {worktrees.data && worktrees.data.worktrees.length === 1 && (
          <p className="text-sm text-muted">
            Solo está el checkout principal. Para que un agente trabaje aparte: <code className="font-mono text-ink-soft">git worktree add ../mi-rama -b mi-rama</code>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-ink">Ramas locales</h2>
        <p className="-mt-2 text-sm text-muted">Cambia la rama del checkout principal. Si hay cambios sin commit, git no deja cambiar.</p>
        {checkout.isError && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{(checkout.error as Error).message}</p>}
        {branches.isPending && <Skeleton className="h-24" />}
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {branches.data?.branches.map((b) => (
            <li key={b.name} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <code className="font-mono text-[0.8125rem] text-ink">{b.name}</code>
                  {b.current && <StatusPill tone="brand">Actual</StatusPill>}
                </span>
                <span className="truncate text-xs text-muted">
                  {formatRelative(b.lastCommitDate)}: {b.subject}
                </span>
              </span>
              {b.current ? null : inWorktree.has(b.name) ? (
                <span className="text-xs text-muted" title={inWorktree.get(b.name)}>
                  Abierta en un worktree
                </span>
              ) : (
                <Button size="sm" isLoading={checkout.isPending && checkout.variables === b.name} onClick={() => checkout.mutate(b.name)}>
                  Cambiar a esta rama
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ProjectDetailWorktrees;
