import SelectField from "@/components/ui/select-field/select-field";
import useGithubBranches from "@/hooks/data/use-github-branches";
import useGithubWorkflows from "@/hooks/data/use-github-workflows";

type GithubPipelinesFiltersProps = {
  projectId: string;
  branch: string;
  onBranchChange: (branch: string) => void;
  workflowId: number;
  onWorkflowChange: (id: number) => void;
};

const GithubPipelinesFilters = ({ projectId, branch, onBranchChange, workflowId, onWorkflowChange }: GithubPipelinesFiltersProps) => {
  const workflows = useGithubWorkflows(projectId);
  const branches = useGithubBranches(projectId);

  return (
    <div className="flex flex-wrap gap-3">
      <SelectField
        label="Workflow"
        value={String(workflowId)}
        onChange={(v) => onWorkflowChange(Number(v))}
        options={[{ value: "0", label: "Todos" }, ...(workflows.data ?? []).map((w) => ({ value: String(w.id), label: w.name }))]}
      />
      <SelectField
        label="Rama"
        value={branch}
        onChange={onBranchChange}
        options={[{ value: "", label: "Todas" }, ...(branches.data ?? []).map((b) => ({ value: b.name, label: b.name }))]}
      />
    </div>
  );
};

export default GithubPipelinesFilters;
