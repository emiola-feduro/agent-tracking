import { useMemo, useState } from "react";
import Combobox from "@/components/ui/combobox/combobox";
import type { ComboboxItem } from "@/hooks/ui/use-combobox";
import NewProjectEntryPills from "./new-project-entry-pills";

type NewProjectSuggestFieldProps = {
  label: string;
  placeholder: string;
  suggest: (query: string) => ComboboxItem[];
  onAdd: (value: string) => void;
  /** Entries added through this field, shown as removable pills. */
  entries: string[];
  onRemove: (value: string) => void;
};

/** Autocomplete field plus the pills for what it added. Typed text can be added as is. */
const NewProjectSuggestField = ({ label, placeholder, suggest, onAdd, entries, onRemove }: NewProjectSuggestFieldProps) => {
  const [query, setQuery] = useState("");
  const items = useMemo(() => suggest(query), [suggest, query]);

  return (
    <div className="flex flex-col gap-3">
      <Combobox
        label={label}
        placeholder={placeholder}
        query={query}
        onQueryChange={setQuery}
        items={items}
        onSelect={onAdd}
        freeTextLabel={(text) => `Agregar "${text}"`}
      />
      <NewProjectEntryPills entries={entries} onRemove={onRemove} />
    </div>
  );
};

export default NewProjectSuggestField;
