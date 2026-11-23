import Button from "@/components/ui/button/button";
import type { StackChoice } from "@/hooks/form/use-stack-suggestion";

type NewProjectStackChoiceProps = {
  choice: StackChoice;
  onAccept: () => void;
  onDismiss: () => void;
};

const NewProjectStackChoice = ({ choice, onAccept, onDismiss }: NewProjectStackChoiceProps) => {
  const { stack, databases, when, recommended } = choice;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {stack.join(", ")}
          {databases.length > 0 && <span className="font-normal text-muted"> con {databases.join(" y ")}</span>}
        </p>
        <p className="text-sm text-ink-soft">{when}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Descartar
        </Button>
        <Button size="sm" variant={recommended ? "primary" : "secondary"} onClick={onAccept}>
          Usar esta
        </Button>
      </div>
    </li>
  );
};

export default NewProjectStackChoice;
