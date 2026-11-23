import Button from "@/components/ui/button/button";

type NewProjectSkillsEmptyProps = {
  decision: boolean | null;
  onDecide: (wantsToAdd: boolean) => void;
};

const NewProjectSkillsEmpty = ({ decision, onDecide }: NewProjectSkillsEmptyProps) => {
  if (decision === false) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-ink-soft">
        Continuarás sin skills. Puedes agregarlas después.
        <Button size="sm" variant="ghost" onClick={() => onDecide(true)}>
          Agregar skills
        </Button>
      </div>
    );
  }
  if (decision === true) return null;

  return (
    <div className="flex flex-col gap-4 rounded-md bg-subtle p-5">
      <p className="font-medium text-ink">No encontramos skills instaladas. ¿Quieres agregar algunas?</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => onDecide(true)}>
          Sí, agregar skills
        </Button>
        <Button onClick={() => onDecide(false)}>No, continuar sin skills</Button>
      </div>
    </div>
  );
};

export default NewProjectSkillsEmpty;
