import Button from "@/components/ui/button/button";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useTestIdeaActions from "@/hooks/data/use-test-idea-actions";
import type { TestIdea } from "@/lib/api";
import { TEST_IDEA_STATUS_LABEL, TEST_IDEA_STATUS_TONE } from "@/lib/labels";

type ProjectDetailTestIdeaItemProps = {
  projectId: string;
  idea: TestIdea;
  target: string | null;
};

const ProjectDetailTestIdeaItem = ({ projectId, idea, target }: ProjectDetailTestIdeaItemProps) => {
  const { id, text, status, origin } = idea;
  const { setStatus, removeIdea } = useTestIdeaActions(projectId);
  const open = status === "proposed" || status === "accepted";

  return (
    <li className="flex animate-enter flex-col gap-2 py-3 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <p className={status === "discarded" ? "text-muted line-through" : "text-ink"}>{text}</p>
        <RemoveButton label={`Eliminar idea ${text}`} onClick={() => removeIdea.mutate(id)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill tone={TEST_IDEA_STATUS_TONE[status]}>{TEST_IDEA_STATUS_LABEL[status]}</StatusPill>
        {origin === "llm" && <StatusPill tone="brand">LLM</StatusPill>}
        {target && <span className="text-muted">{target}</span>}
        {open && (
          <span className="ml-auto flex gap-1">
            {status === "proposed" && (
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ ideaId: id, status: "accepted" })}>
                Aceptar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ ideaId: id, status: "implemented" })}>
              Implementada
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ ideaId: id, status: "discarded" })}>
              Descartar
            </Button>
          </span>
        )}
      </div>
    </li>
  );
};

export default ProjectDetailTestIdeaItem;
