import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";

const ProjectDetailActivityError = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <Alert action={<Button size="sm" onClick={onRetry}>Reintentar</Button>}>No se pudo cargar la actividad.</Alert>
  );
};

export default ProjectDetailActivityError;
