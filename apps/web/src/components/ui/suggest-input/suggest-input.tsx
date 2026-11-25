import { useId, useRef, useState, type ReactNode } from "react";
import { completionOf } from "@/lib/fuzzy";

export type Suggestion = {
  /** Text placed in the field when chosen. */
  value: string;
  /** Shown in the list; defaults to the value. */
  label?: ReactNode;
  /** Small tag on the right: "Archivo", "Función"... */
  kind?: string;
  hint?: string;
};

type SuggestInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Suggestions for the current text; with an empty text, what is worth looking at. */
  suggestions: Suggestion[];
  /** Heading of the list when nothing is typed yet. */
  emptyTitle?: string;
  placeholder?: string;
  className?: string;
};

/**
 * A search field that proposes matches while typing and shows ideas before typing. The first match
 * that starts with the text appears as a grey completion: Tab accepts it, arrows move, Enter picks.
 */
const SuggestInput = ({ label, value, onChange, suggestions, emptyTitle = "Sugerencias", placeholder, className = "" }: SuggestInputProps) => {
  const id = useId();
  const listId = `${id}-list`;
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const shown = suggestions.slice(0, 8);
  const current = shown[Math.min(active, shown.length - 1)];
  const ghost = current ? completionOf(value, current.value) : null;

  const pick = (s: Suggestion) => {
    onChange(s.value);
    setOpen(false);
    input.current?.focus();
  };

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {ghost && open && (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 whitespace-pre">
            <span className="invisible">{value}</span>
            <span className="text-muted/70">{ghost}</span>
          </span>
        )}
        <input
          ref={input}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="both"
          aria-activedescendant={open && current ? `${id}-opt-${Math.min(active, shown.length - 1)}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey && ghost && open) {
              e.preventDefault();
              onChange(value + ghost);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && current) {
              e.preventDefault();
              pick(current);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="relative min-h-10 w-full rounded-md border border-line-strong bg-transparent px-3 text-ink placeholder:text-muted transition-colors duration-150 hover:border-muted"
        />
      </div>
      {open && shown.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
          <p className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-muted">
            <span>{value.trim() ? "Coincidencias" : emptyTitle}</span>
            {ghost && (
              <span>
                <kbd className="rounded-sm border border-line px-1 font-mono">Tab</kbd> completa
              </span>
            )}
          </p>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1">
            {shown.map((s, i) => (
              <li
                key={`${s.kind}-${s.value}-${i}`}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={`flex cursor-pointer items-baseline gap-3 px-3 py-1.5 text-sm ${i === active ? "bg-brand-soft" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate text-ink">{s.label ?? s.value}</span>
                {s.hint && <span className="hidden max-w-[45%] truncate text-xs text-muted sm:inline">{s.hint}</span>}
                {s.kind && <span className="shrink-0 text-xs text-muted">{s.kind}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SuggestInput;
