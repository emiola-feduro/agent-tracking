type ChoiceCardProps = {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  /** checkbox: several can be selected; radio: only one. */
  mode?: "checkbox" | "radio";
};

const ChoiceCard = ({ title, description, selected, onSelect, mode = "checkbox" }: ChoiceCardProps) => {
  return (
    <button
      type="button"
      role={mode}
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors duration-150 ${selected ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong hover:bg-subtle"}`}
    >
      <span className="flex w-full items-center justify-between gap-2 font-semibold text-ink">
        {title}
        <span
          aria-hidden
          className={`grid size-4 place-items-center border transition-colors duration-150 ${mode === "radio" ? "rounded-full" : "rounded-sm"} ${selected ? "border-brand bg-brand" : "border-line-strong bg-surface"}`}
        >
          {selected && <span className={`size-1.5 bg-on-brand ${mode === "radio" ? "rounded-full" : "rounded-[1px]"}`} />}
        </span>
      </span>
      <span className="text-sm text-muted">{description}</span>
    </button>
  );
};

export default ChoiceCard;
