const RemoveButton = ({ label, onClick }: { label: string; onClick: () => void }) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
};

export default RemoveButton;
