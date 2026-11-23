import { Link } from "@tanstack/react-router";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";

type ProjectDetailErrorProps = {
  notFound: boolean;
  onRetry: () => void;
};

const ProjectDetailError = ({ notFound, onRetry }: ProjectDetailErrorProps) => {
  if (notFound) {
    return (
      <Alert tone="warn" action={<Link to="/" className="font-medium underline">Ver proyectos</Link>}>
        Este proyecto no existe o fue eliminado.
      </Alert>
    );
  }
  return <Alert action={<Button size="sm" onClick={onRetry}>Reintentar</Button>}>No se pudo cargar el proyecto.</Alert>;
};

export default ProjectDetailError;
