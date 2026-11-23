type ProgressBarProps = {
  value: number;
  label: string;
  size?: "md" | "lg";
};

const ProgressBar = ({ value, label, size = "md" }: ProgressBarProps) => {
  const done = value >= 100;

  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`flex-1 overflow-hidden rounded-full bg-subtle ${size === "lg" ? "h-2.5" : "h-1.5"}`}
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-500 ease-out-soft ${done ? "bg-ok" : "bg-brand"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`min-w-[4ch] text-right font-semibold tabular-nums ${size === "lg" ? "text-lg" : "text-sm"}`}>
        {value}%
      </span>
    </div>
  );
};

export default ProgressBar;
