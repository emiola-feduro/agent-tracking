import { useMemo } from "react";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useCatalogSkills from "@/hooks/data/use-catalog-skills";
import { withKey } from "@/hooks/form/use-skill-preselection";
import NewProjectSkillCreate from "./new-project-skill-create";
import NewProjectSkillList from "./new-project-skill-list";

const NewProjectSkillAdd = () => {
  const { data, status } = useCatalogSkills(true);
  const catalog = useMemo(() => (data ?? []).map(withKey), [data]);

  return (
    <div className="flex animate-enter flex-col gap-8">
      {status === "pending" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {status === "success" && catalog.length > 0 && <NewProjectSkillList skills={catalog} label="Catálogo de plugins" />}
      {status === "success" && catalog.length === 0 && (
        <p className="text-sm text-muted">No hay marketplaces de plugins en este equipo.</p>
      )}
      <NewProjectSkillCreate />
    </div>
  );
};

export default NewProjectSkillAdd;
