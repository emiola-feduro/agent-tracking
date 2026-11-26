import Alert from "@/components/ui/alert/alert";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useAssistantProviders from "@/hooks/data/use-assistant-providers";
import type { AssistantProviderInfo } from "@/lib/api";
import AssistantSetupNote from "./assistant-setup-note";
import AssistantTaskModels from "./assistant-task-models";

/** The distinct models a provider runs with, after the person's choices per task. */
const modelsText = ({ models, taskDefaults }: AssistantProviderInfo) => {
  const used = [...new Set(Object.entries(taskDefaults).map(([task, fallback]) => models.tasks?.[task as keyof typeof taskDefaults] || fallback))];
  const named = used.filter(Boolean);
  if (named.length === 0) return "Usa el modelo configurado en el CLI.";
  return `${named.length === 1 ? "Modelo" : "Modelos"} ${named.join(", ")}${used.length > named.length ? " y el del CLI" : ""}.`;
};

/** Chooses which available provider answers the stack, DoD and skill suggestions. */
const AssistantProviderPicker = () => {
  const { providers, active, isLoading, isError, choose, isSwitching, switchError, tasks, setModel, modelError } = useAssistantProviders();
  const current = providers.find((p) => p.id === active);

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError) return <Alert>No se pudo leer la lista de proveedores del asistente.</Alert>;
  if (providers.length === 0) return <AssistantSetupNote />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        El asistente sugiere el stack, los criterios del DoD y las skills. Elige quién responde; el cambio dura hasta que
        reinicies el servidor. Para fijarlo, define <code className="font-mono text-[0.8125rem]">AGENT_TRACKING_ASSISTANT_PROVIDER</code>.
      </p>
      <div role="radiogroup" aria-label="Proveedor del asistente" aria-busy={isSwitching} className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <ChoiceCard
            key={provider.id}
            mode="radio"
            title={provider.label}
            description={modelsText(provider)}
            selected={provider.id === active}
            onSelect={() => provider.id !== active && !isSwitching && choose(provider.id)}
          />
        ))}
      </div>
      {switchError && <Alert>{switchError.message}</Alert>}
      {current && tasks.length > 0 && (
        <AssistantTaskModels provider={current} tasks={tasks} onSave={(task, model) => setModel({ provider: current.id, task, model })} />
      )}
      {modelError && <Alert>{modelError.message}</Alert>}
    </div>
  );
};

export default AssistantProviderPicker;
