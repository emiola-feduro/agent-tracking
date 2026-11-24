import type { AgentEvent } from "@/lib/api";
import { describeEvent, formatEventTime } from "@/lib/activity";
import { actorLabel } from "@/lib/labels";

const ProjectDetailActivityItem = ({ event }: { event: AgentEvent }) => {
  const { actor, createdAt } = event;
  const { action, subject, code, detail } = describeEvent(event);

  return (
    <li className="grid animate-enter grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_1fr]">
      <time dateTime={createdAt} className="row-span-2 font-mono text-[13px] text-muted tabular-nums">
        {formatEventTime(createdAt)}
      </time>
      <p className="text-ink">
        <span className="font-medium">{actorLabel(actor)}</span> <span className="text-ink-soft">{action.toLowerCase()}</span>
        {subject && (
          <>
            {" "}
            {code ? <code className="font-mono text-[13px] break-all">{subject}</code> : <span>{subject}</span>}
          </>
        )}
      </p>
      {detail && <p className="text-sm text-muted break-words">{detail}</p>}
    </li>
  );
};

export default ProjectDetailActivityItem;
