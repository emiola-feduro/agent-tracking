import { useId } from "react";
import useCombobox, { type ComboboxItem } from "@/hooks/ui/use-combobox";

type ComboboxProps = {
  label: string;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  items: ComboboxItem[];
  onSelect: (value: string) => void;
  /** Label for the extra option that adds the typed text as is. */
  freeTextLabel?: (text: string) => string;
};

const Combobox = ({ label, placeholder, query, onQueryChange, items, onSelect, freeTextLabel }: ComboboxProps) => {
  const id = useId();
  const typed = query.trim();
  const exact = items.some((i) => i.value.toLowerCase() === typed.toLowerCase());
  const all: ComboboxItem[] =
    typed && !exact && freeTextLabel ? [...items, { value: typed, label: freeTextLabel(typed) }] : items;
  const { isOpen, active, setActive, pick, optionId, listboxProps, inputProps } = useCombobox({
    items: all,
    query,
    setQuery: onQueryChange,
    onSelect,
  });
  const { onChange, ...rest } = inputProps;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-ink placeholder:text-muted transition-colors duration-150 hover:border-muted"
        {...rest}
      />
      <ul
        {...listboxProps}
        aria-label={label}
        hidden={!isOpen}
        className="absolute top-full z-10 mt-1 max-h-72 w-full animate-enter overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(25_26_35/0.12)]"
      >
        {all.map((item, index) => (
          <li
            key={`${item.value}-${index}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Keep focus in the input so the list does not close before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => pick(item.value)}
            className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-3 py-2 transition-colors duration-100 ${index === active ? "bg-brand-soft text-ink" : "text-ink-soft"}`}
          >
            <span className="font-medium">{item.label}</span>
            {item.meta && <span className="text-sm text-muted">{item.meta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Combobox;
