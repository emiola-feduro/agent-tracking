import { useId } from "react";

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

const SelectField = ({ label, value, onChange, options }: SelectFieldProps) => {
  const id = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 w-full min-w-44 rounded-md border border-line-strong bg-surface px-3 text-ink transition-colors duration-150 hover:border-muted"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectField;
