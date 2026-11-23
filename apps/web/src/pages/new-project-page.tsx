import { useEffect } from "react";
import NewProject from "@/components/dynamic/new-project/new-project";
import PageHeader from "@/components/layout/page-header/page-header";
import useWizardStore from "@/stores/use-wizard-store";

const NewProjectPage = () => {
  const reset = useWizardStore((s) => s.reset);

  // Every visit starts a fresh wizard.
  useEffect(() => reset, [reset]);

  return (
    <>
      <PageHeader back={{ to: "/", label: "Proyectos" }} title="Nuevo proyecto" />
      <NewProject />
    </>
  );
};

export default NewProjectPage;
