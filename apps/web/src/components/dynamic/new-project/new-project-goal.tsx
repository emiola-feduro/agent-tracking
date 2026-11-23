import ListEditor from "@/components/ui/list-editor/list-editor";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import useWizardStore from "@/stores/use-wizard-store";

const NewProjectGoal = () => {
  const goal = useWizardStore((s) => s.goal);
  const rules = useWizardStore((s) => s.rules);
  const patch = useWizardStore((s) => s.patch);

  return (
    <div className="flex flex-col gap-6">
      <TextAreaField
        label="Objetivo del proyecto"
        value={goal}
        onChange={(v) => patch({ goal: v })}
        placeholder="Qué problema resuelve y para quién"
        rows={4}
      />
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-ink">Reglas de negocio</h3>
        <ListEditor
          values={rules}
          onChange={(v) => patch({ rules: v })}
          itemLabel="Regla"
          placeholder="Todo pedido requiere un usuario autenticado"
          addLabel="Agregar regla"
        />
      </section>
    </div>
  );
};

export default NewProjectGoal;
