import type { PullDetail } from "@/lib/github-api";
import { relativeTime } from "@/lib/relative-time";

const GithubPullComments = ({ comments }: { comments: PullDetail["comments"] }) => {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-ink">Comentarios ({comments.length})</h4>
      {comments.length === 0 && <p className="text-sm text-muted">Sin comentarios.</p>}
      <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {comments.map(({ id, author, body, createdAt, path, url }) => (
          <li key={id} className="flex flex-col gap-1 text-sm">
            <span className="flex flex-wrap items-center gap-x-2 text-muted">
              <a href={url} target="_blank" rel="noreferrer" className="font-medium text-ink underline-offset-2 hover:underline">
                {author?.login ?? "Usuario eliminado"}
              </a>
              <span>{relativeTime(createdAt)}</span>
              {path && <code className="font-mono text-[12px]">{path}</code>}
            </span>
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-ink-soft">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default GithubPullComments;
