import type { PullDetail } from "@/lib/github-api";

type GithubPullFilesProps = {
  files: PullDetail["files"];
  total: number;
  url: string;
};

const GithubPullFiles = ({ files, total, url }: GithubPullFilesProps) => {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-ink">
        <a href={url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Archivos cambiados ({total})
        </a>
      </h4>
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {files.map(({ filename, additions, deletions }) => (
          <li key={filename} className="flex items-center justify-between gap-3 text-sm">
            <code className="min-w-0 truncate font-mono text-[0.8125rem] text-ink-soft" title={filename}>
              {filename}
            </code>
            <span className="shrink-0 tabular-nums">
              <span className="text-ok">+{additions}</span> <span className="text-danger">-{deletions}</span>
            </span>
          </li>
        ))}
      </ul>
      {total > files.length && <p className="text-sm text-muted">Se muestran {files.length} de {total}.</p>}
    </section>
  );
};

export default GithubPullFiles;
