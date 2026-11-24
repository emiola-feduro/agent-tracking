import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import AssistantSuggestionsSkeleton from "./assistant-suggestions-skeleton";

type AssistantCriteriaSuggestionsProps = {
  pending: string[];
  isLoading: boolean;
  error: Error | null;
  onAccept: (criterion: string) => void;
  onDismiss: (criterion: string) => void;
  onAcceptAll: () => void;
  onDismissAll: () => void;
};

/** Suggested Definition of Done criteria waiting for the person to accept or discard them. */
const AssistantCriteriaSuggestions = ({
  pending,
  isLoading,
  error,
  onAccept,
  onDismiss,
  onAcceptAll,
  onDismissAll,
}: AssistantCriteriaSuggestionsProps) => {
  if (isLoading) return <AssistantSuggestionsSkeleton />;
  if (error) return <Alert>{error.message}</Alert>;
  if (pending.length === 0) return null;

  return (
    <section aria-label="Criterios sugeridos" className="flex animate-enter flex-col gap-2 rounded-md border border-brand/40 bg-brand-soft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">Criterios sugeridos</h4>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onDismissAll}>
            Descartar todos
          </Button>
          <Button size="sm" variant="primary" onClick={onAcceptAll}>
            Aceptar todos
          </Button>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {pending.map((criterion) => (
          <li key={criterion} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-ink">{criterion}</span>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => onDismiss(criterion)} aria-label={`Descartar ${criterion}`}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => onAccept(criterion)} aria-label={`Aceptar ${criterion}`}>
                Aceptar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default AssistantCriteriaSuggestions;
