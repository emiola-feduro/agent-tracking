import { Link } from "@tanstack/react-router";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import ProgressBar from "@/components/ui/progress-bar/progress-bar";
import Skeleton from "@/components/ui/skeleton/skeleton";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useCurrentBranch from "@/hooks/data/use-current-branch";
import useProjectActions from "@/hooks/data/use-project-actions";
import type { ProjectView } from "@/lib/api";
import { kindLabel } from "@/lib/labels";

const ProjectDetailSummary = ({ view }: { view: ProjectView }) => {
  const { project, progress } = view;
  const { id, goal, kind, platforms, stack, databases, repoPath, repoUrl } = project;
  const { sync } = useProjectActions(id);
  const branch = useCurrentBranch(id, !!repoPath);

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5">
      <ProgressBar value={progress.project} label="Avance del proyecto" size="lg" />
      {goal && <p className="max-w-[70ch] text-ink-soft">{goal}</p>}
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">Tipo de proyecto</dt>
        <dd>{kindLabel(kind, platforms)}</dd>
        <dt className="text-muted">Stack</dt>
        <dd className="flex flex-wrap gap-1.5">
          {stack.map((s) => (
            <StatusPill key={s}>{s}</StatusPill>
          ))}
        </dd>
        <dt className="text-muted">Bases de datos</dt>
        <dd>{databases.join(", ") || "Sin definir"}</dd>
        {repoUrl && (
          <>
            <dt className="text-muted">GitHub</dt>
            <dd>
              <a href={repoUrl} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
                {repoUrl.replace("https://github.com/", "")}
              </a>
            </dd>
          </>
        )}
        {repoPath && (
          <>
            <dt className="text-muted">Repositorio local</dt>
            <dd className="flex flex-wrap items-center gap-3">
              <code className="font-mono text-[0.8125rem] break-all">{repoPath}</code>
              <Button size="sm" variant="ghost" isLoading={sync.isPending} onClick={() => sync.mutate()}>
                Actualizar desde el repo
              </Button>
            </dd>
            <dt className="text-muted">Rama actual</dt>
            <dd aria-live="polite" className="flex flex-wrap items-center gap-2">
              {branch.isPending ? (
                <Skeleton className="h-5 w-28 rounded-full" />
              ) : branch.isError ? (
                <span className="text-muted">No se pudo leer</span>
              ) : branch.data?.current ? (
                <StatusPill tone="brand">
                  <span className="font-mono">{branch.data.current}</span>
                </StatusPill>
              ) : (
                <span className="text-muted">Ninguna (HEAD separado)</span>
              )}
              <Link to="/projects/$projectId" params={{ projectId: id }} search={{ tab: "worktrees" }} className="rounded-sm text-sm font-medium text-brand hover:underline">
                Cambiar de rama o ver worktrees
              </Link>
            </dd>
          </>
        )}
      </dl>
      {sync.isError && <Alert>{sync.error.message}</Alert>}
    </section>
  );
};

export default ProjectDetailSummary;
