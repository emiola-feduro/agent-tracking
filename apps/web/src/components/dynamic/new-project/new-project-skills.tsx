import { useState } from "react";
import Button from "@/components/ui/button/button";
import useSkillPreselection from "@/hooks/form/use-skill-preselection";
import NewProjectSkillAdd from "./new-project-skill-add";
import NewProjectSkillList from "./new-project-skill-list";
import NewProjectSkillsEmpty from "./new-project-skills-empty";
import NewProjectSkillsError from "./new-project-skills-error";
import NewProjectSkillsSkeleton from "./new-project-skills-skeleton";

const NewProjectSkills = () => {
  const { skills, status, refetch } = useSkillPreselection();
  // null: not asked yet; true: wants to add skills; false: continues without them.
  const [wantsToAdd, setWantsToAdd] = useState<boolean | null>(null);

  if (status === "pending") return <NewProjectSkillsSkeleton />;
  if (status === "error") return <NewProjectSkillsError onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      {skills.length > 0 ? (
        <NewProjectSkillList skills={skills} />
      ) : (
        <NewProjectSkillsEmpty decision={wantsToAdd} onDecide={setWantsToAdd} />
      )}
      {wantsToAdd === true ? (
        <NewProjectSkillAdd />
      ) : (
        skills.length > 0 && (
          <div>
            <Button variant="ghost" onClick={() => setWantsToAdd(true)}>
              Agregar más skills
            </Button>
          </div>
        )
      )}
    </div>
  );
};

export default NewProjectSkills;
