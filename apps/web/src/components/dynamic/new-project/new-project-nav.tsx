import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import useCreateProject from "@/hooks/form/use-create-project";
import useWizardStore, { isStepValid, WIZARD_STEPS } from "@/stores/use-wizard-store";

const NewProjectNav = () => {
  const state = useWizardStore();
  const { step, goTo } = state;
  const create = useCreateProject();
  const isLast = step === WIZARD_STEPS.length - 1;

  return (
    <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:px-6">
      {create.isError && <Alert>{create.error.message}</Alert>}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
          Atrás
        </Button>
        {isLast ? (
          <Button variant="primary" isLoading={create.isPending} onClick={() => create.mutate()}>
            Crear proyecto
          </Button>
        ) : (
          <Button variant="primary" disabled={!isStepValid(state, step)} onClick={() => goTo(step + 1)}>
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
};

export default NewProjectNav;
