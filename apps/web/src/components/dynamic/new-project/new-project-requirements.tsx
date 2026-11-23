import Button from "@/components/ui/button/button";
import useWizardStore from "@/stores/use-wizard-store";
import NewProjectRequirementCard from "./new-project-requirement-card";

const NewProjectRequirements = () => {
  const requirements = useWizardStore((s) => s.requirements);
  const addRequirement = useWizardStore((s) => s.addRequirement);

  return (
    <div className="flex flex-col gap-4">
      {requirements.map((requirement, index) => (
        <NewProjectRequirementCard key={requirement.key} requirement={requirement} index={index} />
      ))}
      <div>
        <Button onClick={addRequirement}>Agregar requerimiento</Button>
      </div>
    </div>
  );
};

export default NewProjectRequirements;
