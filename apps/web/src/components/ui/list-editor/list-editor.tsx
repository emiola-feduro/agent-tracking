import Button from "@/components/ui/button/button";
import RemoveButton from "@/components/ui/remove-button/remove-button";

type ListEditorProps = {
  values: string[];
  onChange: (values: string[]) => void;
  itemLabel: string;
  placeholder: string;
  addLabel: string;
};

/** Editable list of short texts (rules, DoD criteria). */
const ListEditor = ({ values, onChange, itemLabel, placeholder, addLabel }: ListEditorProps) => {
  const update = (index: number, value: string) => onChange(values.map((v, i) => (i === index ? value : v)));
  const remove = (index: number) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2">
      {values.map((value, index) => (
        <div key={index} className="flex animate-enter items-center gap-2">
          <input
            value={value}
            onChange={(e) => update(index, e.target.value)}
            placeholder={placeholder}
            aria-label={`${itemLabel} ${index + 1}`}
            className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 placeholder:text-muted transition-colors duration-150 hover:border-muted"
          />
          <RemoveButton label={`Quitar ${itemLabel.toLowerCase()} ${index + 1}`} onClick={() => remove(index)} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" onClick={() => onChange([...values, ""])}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
};

export default ListEditor;
