type SegmentedProps<T extends string> = {
  label: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** A small single-choice filter (radio group styled as joined buttons). */
const Segmented = <T extends string>({ label, items, value, onChange }: SegmentedProps<T>) => {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit self-start rounded-md border border-line-strong bg-surface p-0.5">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(item.value)}
            className={`min-h-8 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 ${selected ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-subtle hover:text-ink"}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default Segmented;
