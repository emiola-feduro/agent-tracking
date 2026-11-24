import AssistantCriteriaSuggestions from "@/components/dynamic/assistant/assistant-criteria-suggestions";
import Button from "@/components/ui/button/button";
import ListEditor from "@/components/ui/list-editor/list-editor";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import StatusPill from "@/components/ui/status-pill/status-pill";
import useAssistantStatus from "@/hooks/data/use-assistant-status";
import useCriteriaSuggestions from "@/hooks/form/use-criteria-suggestions";
import { api } from "@/lib/api";
import useWizardStore, { wizardBrief, type RequirementDraft } from "@/stores/use-wizard-store";

const NewProjectRequirementDod = ({ requirement }: { requirement: RequirementDraft }) => {
  const { key, title, description, dod, llmDod } = requirement;
  const setRequirement = useWizardStore((s) => s.setRequirement);
  const { configured } = useAssistantStatus();
  const suggestions = useCriteriaSuggestions({
    fetch: () => {
      const existing = [...dod, ...llmDod].map((c) => c.trim()).filter(Boolean);
      return api.suggestDod(wizardBrief(useWizardStore.getState()), { title, description }, existing);
    },
    accept: (criteria) => {
      const current = useWizardStore.getState().requirements.find((r) => r.key === key)?.llmDod ?? [];
      setRequirement(key, { llmDod: [...current, ...criteria] });
    },
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">Definition of Done</h3>
        {configured && (
          <Button size="sm" onClick={suggestions.suggest} isLoading={suggestions.isLoading} disabled={!title.trim()}>
            Sugerir con IA
          </Button>
        )}
      </div>
      {llmDod.length > 0 && (
        <ul aria-label="Criterios aceptados de la IA" className="flex flex-col gap-2">
          {llmDod.map((criterion, index) => (
            <li key={criterion} className="flex min-h-10 animate-enter items-center gap-2 rounded-md border border-line px-3">
              <span className="flex-1 text-ink">{criterion}</span>
              <StatusPill tone="brand">LLM</StatusPill>
              <RemoveButton
                label={`Quitar criterio ${criterion}`}
                onClick={() => setRequirement(key, { llmDod: llmDod.filter((_, i) => i !== index) })}
              />
            </li>
          ))}
        </ul>
      )}
      <ListEditor
        values={dod}
        onChange={(v) => setRequirement(key, { dod: v })}
        itemLabel="Criterio"
        placeholder="Criterio verificable"
        addLabel="Agregar criterio"
      />
      <AssistantCriteriaSuggestions
        pending={suggestions.pending}
        isLoading={suggestions.isLoading}
        error={suggestions.error}
        onAccept={suggestions.acceptOne}
        onDismiss={suggestions.dismissOne}
        onAcceptAll={suggestions.acceptAll}
        onDismissAll={suggestions.dismissAll}
      />
    </section>
  );
};

export default NewProjectRequirementDod;
