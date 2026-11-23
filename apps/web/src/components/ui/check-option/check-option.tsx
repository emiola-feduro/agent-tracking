import type { ReactNode } from "react";

type CheckOptionProps = {
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  description?: string;
  meta?: ReactNode;
  /** radio: one per `name` group; clicking the selected one clears it. */
  type?: "checkbox" | "radio";
  name?: string;
};

const CheckOption = ({ checked, onChange, label, description, meta, type = "checkbox", name }: CheckOptionProps) => {
  return (
    <label
      className={`flex min-h-10 cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors duration-150 ${checked ? "bg-brand-soft" : "hover:bg-subtle"}`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        // Radios only fire change when becoming checked; click also lets the selected one be cleared.
        onChange={type === "checkbox" ? onChange : () => {}}
        onClick={type === "radio" ? onChange : undefined}
        className="mt-1 size-4 shrink-0 accent-brand"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
          {label}
          {meta}
        </span>
        {description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
};

export default CheckOption;
