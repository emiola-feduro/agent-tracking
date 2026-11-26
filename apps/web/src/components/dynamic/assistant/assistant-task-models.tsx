import { useEffect, useState } from "react";
import SelectField from "@/components/ui/select-field/select-field";
import TextField from "@/components/ui/text-field/text-field";
import type { AssistantProviderInfo, AssistantProviders, AssistantTaskId } from "@/lib/api";

const DEFAULT = "";
const OTHER = "__other";

type TaskRowProps = {
  provider: AssistantProviderInfo;
  task: AssistantProviders["tasks"][number];
  onSave: (task: AssistantTaskId, model: string) => void;
};

/** One task: the provider's default, a suggested model, or any other name typed by the person. */
const TaskRow = ({ provider, task, onSave }: TaskRowProps) => {
  const chosen = provider.models.tasks?.[task.id] ?? "";
  const custom = chosen !== "" && !provider.suggestedModels.includes(chosen);
  const [other, setOther] = useState(custom);
  const [typed, setTyped] = useState(custom ? chosen : "");
  useEffect(() => {
    setOther(custom);
    setTyped(custom ? chosen : "");
  }, [chosen, custom]);

  const fallback = provider.taskDefaults[task.id];
  const options = [
    { value: DEFAULT, label: `Por defecto (${fallback || "el modelo del CLI"})` },
    ...provider.suggestedModels.map((m) => ({ value: m, label: m })),
    { value: OTHER, label: "Otro modelo…" },
  ];
  const saveTyped = () => typed.trim() !== chosen && onSave(task.id, typed.trim());

  return (
    <li className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-start sm:gap-4">
      <div className="pt-1">
        <p className="font-medium text-ink">{task.label}</p>
        <p className="text-sm text-muted">{task.description}</p>
      </div>
      <div className="flex flex-col gap-2">
        <SelectField
          label={`Modelo para ${task.label.charAt(0).toLowerCase()}${task.label.slice(1)}`}
          value={other ? OTHER : chosen}
          options={options}
          onChange={(v) => {
            if (v === OTHER) return setOther(true);
            setOther(false);
            onSave(task.id, v);
          }}
        />
        {other && (
          <TextField
            label="Nombre del modelo"
            value={typed}
            onChange={setTyped}
            onBlur={saveTyped}
            onKeyDown={(e) => e.key === "Enter" && saveTyped()}
            placeholder={provider.suggestedModels[0]}
            spellCheck={false}
            autoComplete="off"
            hint="Se guarda al salir del campo o con Enter."
          />
        )}
      </div>
    </li>
  );
};

type AssistantTaskModelsProps = {
  provider: AssistantProviderInfo;
  tasks: AssistantProviders["tasks"];
  onSave: (task: AssistantTaskId, model: string) => void;
};

/** The model the active provider uses for each kind of suggestion; stored on the server. */
const AssistantTaskModels = ({ provider, tasks, onSave }: AssistantTaskModelsProps) => (
  <section className="flex flex-col gap-3 border-t border-line pt-4">
    <div>
      <h3 className="font-semibold text-ink">Modelo por tarea con {provider.label}</h3>
      <p className="text-sm text-muted">
        Usa un modelo más capaz donde importa el criterio y uno más rápido para lo simple. Se guarda y se mantiene al reiniciar el servidor.
      </p>
    </div>
    <ul className="flex flex-col gap-4">
      {tasks.map((task) => (
        <TaskRow key={task.id} provider={provider} task={task} onSave={onSave} />
      ))}
    </ul>
  </section>
);

export default AssistantTaskModels;
