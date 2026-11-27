import { requirementCodeProblem } from "@agent-tracking/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import TextField from "@/components/ui/text-field/text-field";
import { api, type ProjectView, type Requirement } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The requirement's short code (RF1, RNF2…), which agents and people can write instead of its title.
 * Saved on blur or Enter; a code another requirement already uses is rejected before sending.
 */
const ProjectDetailRequirementCode = ({ requirement, view }: { requirement: Requirement; view: ProjectView }) => {
  const saved = requirement.code ?? "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (code: string) => api.updateRequirement(view.project.id, requirement.id, { code }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(view.project.id) }),
  });
  const others = view.requirements.filter((r) => r.id !== requirement.id).map((r) => r.code);
  const problem = value.trim().toUpperCase() === saved ? null : requirementCodeProblem(value, others);
  const commit = () => {
    const code = value.trim().toUpperCase();
    if (code === saved) return setValue(saved);
    if (!problem) save.mutate(code);
  };

  return (
    <div className="max-w-56">
      <TextField
        label="Código"
        value={value}
        onChange={(v) => setValue(v.toUpperCase())}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        spellCheck={false}
        autoComplete="off"
        maxLength={20}
        error={problem ?? (save.error as Error | null)?.message ?? null}
        hint="Escríbelo en vez del título, también al hablar con los agentes."
      />
    </div>
  );
};

export default ProjectDetailRequirementCode;
