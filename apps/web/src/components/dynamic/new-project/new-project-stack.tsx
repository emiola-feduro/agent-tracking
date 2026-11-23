import useStackDefaults from "@/hooks/form/use-stack-defaults";
import NewProjectStackDatabases from "./new-project-stack-databases";
import NewProjectStackError from "./new-project-stack-error";
import NewProjectStackGroups from "./new-project-stack-groups";
import NewProjectStackRecommendation from "./new-project-stack-recommendation";
import NewProjectStackSkeleton from "./new-project-stack-skeleton";

const NewProjectStack = () => {
  const { recommendation, apply } = useStackDefaults();
  const { data, status, refetch } = recommendation;

  if (status === "pending") return <NewProjectStackSkeleton />;
  if (status === "error") return <NewProjectStackError onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-8">
      <NewProjectStackRecommendation recommendation={data} onApply={apply} />
      <NewProjectStackGroups />
      <NewProjectStackDatabases />
    </div>
  );
};

export default NewProjectStack;
