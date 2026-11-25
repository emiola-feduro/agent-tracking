import TokenButton from "@/components/ui/token-button/token-button";
import AssistantSuggestionsSkeleton from "@/components/dynamic/assistant/assistant-suggestions-skeleton";
import Alert from "@/components/ui/alert/alert";
import useAssistantStatus from "@/hooks/data/use-assistant-status";
import useStackSuggestion from "@/hooks/form/use-stack-suggestion";
import NewProjectStackChoice from "./new-project-stack-choice";

type NewProjectStackAssistantProps = {
  onApply: (stack: string[], databases: string[]) => void;
};

const NewProjectStackAssistant = ({ onApply }: NewProjectStackAssistantProps) => {
  const { configured } = useAssistantStatus();
  const { choices, suggest, isLoading, error, fellBack, accept, dismiss } = useStackSuggestion(onApply);
  if (!configured) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">Sugerencia con IA</h3>
        <TokenButton size="sm" onClick={suggest} isLoading={isLoading}>
          {choices.length ? "Sugerir otra vez" : "Sugerir con IA"}
        </TokenButton>
      </div>
      {isLoading && <AssistantSuggestionsSkeleton rows={2} />}
      {!isLoading && error && <Alert>{error.message}</Alert>}
      {!isLoading && fellBack && (
        <Alert tone="warn">La IA no devolvió una propuesta válida. Puedes usar las propuestas para estas plataformas o intentar otra vez.</Alert>
      )}
      {!isLoading && choices.length > 0 && (
        <ul aria-label="Propuestas de la IA" className="flex animate-enter flex-col divide-y divide-line rounded-md border border-brand/40 bg-brand-soft/40">
          {choices.map((choice, index) => (
            <NewProjectStackChoice key={index} choice={choice} onAccept={() => accept(choice)} onDismiss={() => dismiss(choice)} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default NewProjectStackAssistant;
