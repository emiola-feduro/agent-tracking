import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withKey } from "@/hooks/form/use-skill-preselection";
import { api } from "@/lib/api";
import useWizardStore from "@/stores/use-wizard-store";

/** Creates a SKILL.md and selects it for the project being configured. */
const useCreateSkill = () => {
  const queryClient = useQueryClient();
  const toggleSkill = useWizardStore((s) => s.toggleSkill);

  return useMutation({
    mutationFn: api.createSkill,
    onSuccess: (skill) => {
      toggleSkill(withKey(skill));
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
};

export default useCreateSkill;
