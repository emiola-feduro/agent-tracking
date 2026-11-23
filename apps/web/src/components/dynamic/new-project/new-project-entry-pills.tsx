type NewProjectEntryPillsProps = {
  entries: string[];
  onRemove: (value: string) => void;
};

const NewProjectEntryPills = ({ entries, onRemove }: NewProjectEntryPillsProps) => {
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map((name) => (
        <li key={name} className="animate-enter">
          <button
            type="button"
            onClick={() => onRemove(name)}
            aria-label={`Quitar ${name}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand transition-colors hover:bg-danger-soft hover:text-danger"
          >
            {name}
            <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default NewProjectEntryPills;
