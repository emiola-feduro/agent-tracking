import StatusPill from "@/components/ui/status-pill/status-pill";
import type { PullDetail } from "@/lib/github-api";
import { REVIEW_STATE } from "@/lib/github-labels";
import { relativeTime } from "@/lib/relative-time";

const tone = { approved: "ok", changes_requested: "danger", commented: "neutral", dismissed: "neutral", pending: "warn" } as const;

const GithubPullReviews = ({ reviews }: { reviews: PullDetail["reviews"] }) => {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-ink">Reviews</h4>
      {reviews.length === 0 && <p className="text-sm text-muted">Nadie lo ha revisado todavía.</p>}
      <ul className="flex flex-col gap-1.5">
        {reviews.map(({ id, author, state, submittedAt, url }) => (
          <li key={id} className="flex flex-wrap items-center gap-2 text-sm">
            <a href={url} target="_blank" rel="noreferrer" className="text-ink underline-offset-2 hover:underline">
              {author?.login ?? "Usuario eliminado"}
            </a>
            <StatusPill tone={tone[state] ?? "neutral"}>{REVIEW_STATE[state] ?? state}</StatusPill>
            <span className="text-muted">{relativeTime(submittedAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default GithubPullReviews;
