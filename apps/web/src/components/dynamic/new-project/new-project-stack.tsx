import AssistantSetupNote from "@/components/dynamic/assistant/assistant-setup-note";
import useStackDefaults from "@/hooks/form/use-stack-defaults";
import NewProjectArchitecture from "./new-project-architecture";
import NewProjectStackAssistant from "./new-project-stack-assistant";
import NewProjectStackDatabases from "./new-project-stack-databases";
import NewProjectStackError from "./new-project-stack-error";
import NewProjectStackGroups from "./new-project-stack-groups";
import NewProjectStackRecommendation from "./new-project-stack-recommendation";
import NewProjectStackSkeleton from "./new-project-stack-skeleton";
import NewProjectMonorepoTool from "./new-project-monorepo-tool";
import NewProjectStackParts from "./new-project-stack-parts";
import NewProjectTestTypes from "./new-project-test-types";
import useWizardStore from "@/stores/use-wizard-store";

const NewProjectStack = () => {
  const { recommendation, apply } = useStackDefaults();
  const { data, status, refetch } = recommendation;
  const monorepo = useWizardStore((s) => s.structure === "monorepo");

  if (status === "pending" && !monorepo) return <NewProjectStackSkeleton />;
  if (status === "error") return <NewProjectStackError onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-8">
      {monorepo && <NewProjectStackParts />}
      <AssistantSetupNote />
      <NewProjectStackAssistant onApply={apply} />
      {data ? <NewProjectStackRecommendation recommendation={data} onApply={apply} /> : <NewProjectStackSkeleton />}
      <NewProjectStackGroups />
      <NewProjectStackDatabases />
      <NewProjectArchitecture />
      {monorepo && <NewProjectMonorepoTool />}
      <NewProjectTestTypes />
    </div>
  );
};

export default NewProjectStack;
