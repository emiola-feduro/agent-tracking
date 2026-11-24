type TabsProps<T extends string> = {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
};

const Tabs = <T extends string>({ items, value, onChange, label }: TabsProps<T>) => {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden pt-1 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:thin]">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={`min-h-12 shrink-0 whitespace-nowrap border-b-2 px-3.5 text-sm font-medium transition-colors duration-150 ${selected ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
