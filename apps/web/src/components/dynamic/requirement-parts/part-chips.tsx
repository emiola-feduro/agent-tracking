import type { ProjectPart } from "@/lib/api";

type PartChipsProps = {
  parts: ProjectPart[];
  value: string[];
  onChange: (next: string[]) => void;
};

/** Which pieces of a monorepo a requirement touches; none means the whole project. */
const PartChips = ({ parts, value, onChange }: PartChipsProps) => {
  if (parts.length === 0) return null;
  return (
    <div role="group" aria-label="Piezas que toca" className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-medium text-ink">Piezas que toca</span>
      {parts.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            title={p.path}
            onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className={`min-h-7 rounded-full border px-2.5 text-sm transition-colors duration-150 ${on ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft hover:border-line-strong hover:text-ink"}`}
          >
            {p.name}
          </button>
        );
      })}
      {value.length === 0 && <span className="text-sm text-muted">Todo el proyecto</span>}
    </div>
  );
};

export default PartChips;
