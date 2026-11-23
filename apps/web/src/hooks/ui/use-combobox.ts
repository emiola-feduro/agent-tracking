import { useId, useState, type KeyboardEvent } from "react";

export type ComboboxItem = { value: string; label: string; meta?: string };

type UseComboboxArgs = {
  items: ComboboxItem[];
  query: string;
  setQuery: (query: string) => void;
  onSelect: (value: string) => void;
};

/**
 * Keyboard and open state for an ARIA 1.2 combobox with a listbox popup. While typing, the first
 * item is highlighted so Enter takes the best match; free text comes as an item of its own.
 */
const useCombobox = ({ items, query, setQuery, onSelect }: UseComboboxArgs) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const isOpen = open && items.length > 0;

  const pick = (value: string) => {
    onSelect(value);
    setQuery("");
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (items.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = isOpen && active >= 0 ? items[active] : undefined;
      if (item) pick(item.value);
      else if (query.trim()) pick(query.trim());
    } else if (e.key === "Escape") {
      if (isOpen) setOpen(false);
      else setQuery("");
      setActive(-1);
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return {
    isOpen,
    active,
    setActive,
    pick,
    optionId,
    listboxProps: { id: listId, role: "listbox" as const },
    inputProps: {
      role: "combobox" as const,
      "aria-expanded": isOpen,
      "aria-controls": listId,
      "aria-autocomplete": "list" as const,
      "aria-activedescendant": isOpen && active >= 0 ? optionId(active) : undefined,
      onKeyDown,
      onFocus: () => setOpen(true),
      onBlur: () => (setOpen(false), setActive(-1)),
      onChange: (value: string) => (setQuery(value), setOpen(true), setActive(value.trim() ? 0 : -1)),
    },
  };
};

export default useCombobox;
