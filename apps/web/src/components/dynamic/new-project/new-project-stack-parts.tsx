import Tabs from "@/components/ui/tabs/tabs";
import useWizardStore, { activePartOf } from "@/stores/use-wizard-store";

/** In a monorepo, the stack is chosen piece by piece: one tab per piece, with how many are done. */
const NewProjectStackParts = () => {
  const parts = useWizardStore((s) => s.parts);
  const active = useWizardStore((s) => activePartOf(s)?.id ?? "");
  const patch = useWizardStore((s) => s.patch);
  if (parts.length === 0) return null;
  const ready = parts.filter((p) => p.stack.length > 0).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-ink">Stack de cada pieza</h3>
        <span className="text-sm tabular-nums text-muted">
          {ready} de {parts.length} con stack
        </span>
      </div>
      <Tabs
        label="Piezas del monorepo"
        items={parts.map((p) => ({ value: p.id, label: `${p.name || "Sin nombre"}${p.stack.length ? "" : " (sin stack)"}` }))}
        value={active}
        onChange={(id) => patch({ activePart: id })}
      />
      <p className="text-sm text-muted">
        Estás eligiendo el stack de <span className="font-medium text-ink">{parts.find((p) => p.id === active)?.name}</span> en{" "}
        <code className="font-mono text-[0.8125rem]">{parts.find((p) => p.id === active)?.path}</code>. Las bases de datos son del proyecto entero.
      </p>
    </div>
  );
};

export default NewProjectStackParts;
