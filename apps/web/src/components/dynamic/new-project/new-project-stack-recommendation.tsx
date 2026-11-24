import Button from "@/components/ui/button/button";
import type { StackRecommendation } from "@/lib/api";

type NewProjectStackRecommendationProps = {
  recommendation: StackRecommendation;
  onApply: (stack: string[], databases: string[]) => void;
};

const NewProjectStackRecommendation = ({ recommendation, onApply }: NewProjectStackRecommendationProps) => {
  const { stack, databases, rationale, alternatives } = recommendation;
  const options = [{ stack, databases, when: rationale, recommended: true }, ...alternatives.map((a) => ({ ...a, recommended: false }))];

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-semibold text-ink">Propuestas para este proyecto</h3>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {options.map((option, index) => (
          <li key={index} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {option.stack.join(", ")}
                <span className="font-normal text-muted"> con {option.databases.join(" y ")}</span>
              </p>
              <p className="text-sm text-ink-soft">{option.when}</p>
            </div>
            <Button size="sm" variant={option.recommended ? "primary" : "secondary"} onClick={() => onApply(option.stack, option.databases)}>
              {option.recommended ? "Usar recomendada" : "Usar esta"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default NewProjectStackRecommendation;
