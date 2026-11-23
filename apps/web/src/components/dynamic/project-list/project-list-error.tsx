import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";

const ProjectListError = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <Alert action={<Button size="sm" onClick={onRetry}>Reintentar</Button>}>
      No se pudo conectar con la API de Agent Tracking.
    </Alert>
  );
};

export default ProjectListError;
