import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";

const NewProjectStackError = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <Alert action={<Button size="sm" onClick={onRetry}>Reintentar</Button>}>
      No se pudieron cargar las opciones de stack.
    </Alert>
  );
};

export default NewProjectStackError;
