import { useCallback, useState } from "react";

/** Which items of a list are open, with "open all" and "close all". */
const useExpanded = (initial: Iterable<string> = []) => {
  const [open, setOpen] = useState(() => new Set(initial));
  const toggle = useCallback(
    (id: string) =>
      setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const setAll = useCallback((ids: string[]) => setOpen(new Set(ids)), []);
  return { isOpen: (id: string) => open.has(id), toggle, setAll, count: open.size };
};

export type Expanded = ReturnType<typeof useExpanded>;
export default useExpanded;
