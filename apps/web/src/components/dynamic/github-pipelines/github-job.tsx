import StatusPill from "@/components/ui/status-pill/status-pill";
import type { RunDetail } from "@/lib/github-api";
import { RUN_STATUS } from "@/lib/github-labels";
import { duration } from "@/lib/relative-time";

const GithubJob = ({ job }: { job: RunDetail["jobs"][number] }) => {
  const { name, status, startedAt, completedAt, url, steps } = job;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{name}</span>
        <StatusPill tone={RUN_STATUS[status].tone}>{RUN_STATUS[status].label}</StatusPill>
        <span className="text-sm tabular-nums text-muted">{duration(startedAt, completedAt)}</span>
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto text-sm text-brand underline-offset-2 hover:underline">
          Ver logs
        </a>
      </div>
      <ol className="flex flex-col gap-1 border-l border-line pl-4">
        {steps.map((step) => (
          <li key={step.number} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft">
              <span className="tabular-nums text-muted">{step.number}.</span> {step.name}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-muted">{duration(step.startedAt, step.completedAt)}</span>
              <StatusPill tone={RUN_STATUS[step.status].tone}>{RUN_STATUS[step.status].label}</StatusPill>
            </span>
          </li>
        ))}
      </ol>
    </li>
  );
};

export default GithubJob;
