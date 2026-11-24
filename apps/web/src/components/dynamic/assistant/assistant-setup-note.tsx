import Alert from "@/components/ui/alert/alert";
import useAssistantStatus from "@/hooks/data/use-assistant-status";

/** Shown instead of the assistant actions when the server cannot reach Claude. */
const AssistantSetupNote = () => {
  const { disabled } = useAssistantStatus();
  if (!disabled) return null;

  return (
    <Alert tone="info">
      Las sugerencias con IA están desactivadas. Para activarlas, inicia sesión en Claude Code en este equipo
      (<code className="font-mono text-[0.8125rem]">claude</code>, usa tu suscripción) o define{" "}
      <code className="font-mono text-[0.8125rem]">ANTHROPIC_API_KEY</code>, y reinicia el servidor.
    </Alert>
  );
};

export default AssistantSetupNote;
