import Alert from "@/components/ui/alert/alert";
import useAssistantStatus from "@/hooks/data/use-assistant-status";

/** Shown instead of the assistant actions when the server has no Claude API key. */
const AssistantSetupNote = () => {
  const { disabled } = useAssistantStatus();
  if (!disabled) return null;

  return (
    <Alert tone="info">
      Las sugerencias con IA están desactivadas. Para activarlas, define <code className="font-mono text-[13px]">ANTHROPIC_API_KEY</code> en
      el entorno del servidor y reinícialo.
    </Alert>
  );
};

export default AssistantSetupNote;
