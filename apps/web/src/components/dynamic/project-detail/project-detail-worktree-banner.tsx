import { useState } from "react";
import Button from "@/components/ui/button/button";
import DiffView from "@/components/ui/diff-view/diff-view";
import Skeleton from "@/components/ui/skeleton/skeleton";
import { useWorktreeDiff, useWorktrees } from "@/hooks/data/use-worktrees";
import useCheckoutView from "@/hooks/ui/use-checkout-view";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** While another worktree is being looked at: which one, what it holds against the base, and the way back. */
const ProjectDetailWorktreeBanner = ({ projectId }: { projectId: string }) => {
  const view = useCheckoutView(projectId);
  const { data } = useWorktrees(projectId, !!view.worktree);
  const [showDiff, setShowDiff] = useState(false);
  const diff = useWorktreeDiff(projectId, showDiff ? view.worktree : null);
  if (!view.worktree) return null;
  const w = data?.worktrees.find((x) => x.path === view.worktree);
  const p = w?.progress;

  return (
    <section aria-label="Worktree que estás viendo" className="flex animate-enter flex-col gap-3 rounded-lg border border-brand/40 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-ink">
            Estás viendo el worktree <code className="font-mono text-[0.8125rem]">{view.worktree.split("/").pop()}</code>
            {w?.branch && (
              <>
                {" "}
                en la rama <code className="font-mono text-[0.8125rem] text-brand">{w.branch}</code>
              </>
            )}
            .
          </p>
          <p className="text-sm text-ink-soft">
            {!data
              ? "Leyendo el worktree..."
              : !w
                ? "Ese worktree ya no existe."
                : p
                  ? `${plural(p.ahead, "commit", "commits")} adelante de ${data.base ?? "la base"}${p.behind ? `, ${p.behind} atrás` : ""}; ${p.dirty ? `${plural(p.dirty, "archivo", "archivos")} sin commit` : "nada sin commit"}. El código, la rama y el último turno de esta página vienen de aquí.`
                  : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {w && (
            <Button size="sm" variant="secondary" onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? "Ocultar cambios" : "Ver cambios"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => view.set(null)}>
            Volver al checkout principal
          </Button>
        </div>
      </div>
      {showDiff &&
        (diff.isPending ? (
          <Skeleton className="h-20" />
        ) : diff.isError ? (
          <p className="text-sm text-danger">{(diff.error as Error).message}</p>
        ) : (
          <DiffView patch={diff.data.patch} files={diff.data.files} truncated={diff.data.truncated} openUpTo={2} />
        ))}
    </section>
  );
};

export default ProjectDetailWorktreeBanner;
