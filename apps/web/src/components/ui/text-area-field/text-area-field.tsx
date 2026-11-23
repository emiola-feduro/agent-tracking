import { useId, type TextareaHTMLAttributes } from "react";

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
};

const TextAreaField = ({ label, value, onChange, hideLabel = false, className = "", ...rest }: TextAreaFieldProps) => {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-ink"}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-ink placeholder:text-muted transition-colors duration-150 hover:border-muted"
        {...rest}
      />
    </div>
  );
};

export default TextAreaField;
