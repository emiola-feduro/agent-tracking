import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";

const NewProjectSkillsError = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <Alert action={<Button size="sm" onClick={onRetry}>Reintentar</Button>}>No se pudieron leer las skills instaladas.</Alert>
  );
};

export default NewProjectSkillsError;
