import type { ComponentProps } from "react";
import Button from "@/components/ui/button/button";
import useAssistantStatus from "@/hooks/data/use-assistant-status";

/**
 * A button whose click calls the active assistant provider and spends its tokens. A slow sheen and a twinkling spark set it
 * apart from free actions; both stop with reduced motion and while it is working.
 */
const TokenButton = ({ children, className = "", title, isLoading, ...rest }: ComponentProps<typeof Button>) => {
  const { vendor } = useAssistantStatus();
  const spends = vendor ? `Usa tokens de ${vendor}` : "Usa tokens del asistente";

  return (
    <Button
      {...rest}
      isLoading={isLoading}
      title={title ?? spends}
      aria-description={spends}
      className={`${isLoading ? "" : "token-button"} ${className}`}
    >
      {!isLoading && (
        <svg aria-hidden viewBox="0 0 16 16" className="token-spark size-3.5 text-brand" fill="currentColor">
          <path d="M8 1.5c.3 2.6 1.9 4.2 4.5 4.5-2.6.3-4.2 1.9-4.5 4.5-.3-2.6-1.9-4.2-4.5-4.5 2.6-.3 4.2-1.9 4.5-4.5Z" />
          <path d="M12.5 10c.15 1.15.85 1.85 2 2-1.15.15-1.85.85-2 2-.15-1.15-.85-1.85-2-2 1.15-.15 1.85-.85 2-2Z" opacity=".7" />
        </svg>
      )}
      {children}
    </Button>
  );
};

export default TokenButton;
