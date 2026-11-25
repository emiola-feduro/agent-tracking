import Alert from "@/components/ui/alert/alert";
import ChoiceCard from "@/components/ui/choice-card/choice-card";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useAssistantProviders from "@/hooks/data/use-assistant-providers";
import type { AssistantProviderInfo } from "@/lib/api";
import AssistantSetupNote from "./assistant-setup-note";

const modelsText = ({ models }: AssistantProviderInfo) => {
  if (!models.default && !models.heavy) return "Usa el modelo configurado en el CLI.";
  if (!models.heavy || models.default === models.heavy) return `Modelo ${models.default || models.heavy}.`;
  if (!models.default) return `Modelo del CLI y ${models.heavy} para el stack.`;
  return `Modelos ${models.default} y ${models.heavy} para el stack.`;
};

/** Chooses which available provider answers the stack, DoD and skill suggestions. */
const AssistantProviderPicker = () => {
  const { providers, active, isLoading, isError, choose, isSwitching, switchError } = useAssistantProviders();

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
    </div>
  );
};

export default AssistantProviderPicker;
