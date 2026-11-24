import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import useProjects from "@/hooks/data/use-projects";
import { kindLabel } from "@/lib/labels";

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Jump to any project from anywhere: the button in the header shows the current one, and
 * Ctrl+K (Cmd+K on macOS) opens the same list with search and keyboard navigation.
 */
const ProjectSwitcher = () => {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const navigate = useNavigate();
  const { data: projects = [], isPending } = useProjects();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const current = projects.find((p) => p.id === projectId);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return projects.filter((p) => !q || normalize(`${p.name} ${p.goal} ${p.repoPath ?? ""}`).includes(q));
  }, [projects, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setActive(Math.max(0, projects.findIndex((p) => p.id === projectId)));
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, projects, projectId]);

  const go = (id: string) => {
    setOpen(false);
    navigate({ to: "/projects/$projectId", params: { projectId: id }, search: (prev: { tab?: string }) => ({ tab: prev.tab ?? "requirements" }) as never });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-line px-2.5 text-sm text-ink-soft transition-colors duration-150 hover:bg-subtle hover:text-ink"
      >
        <span className="truncate font-medium text-ink">{current?.name ?? "Cambiar de proyecto"}</span>
        <kbd className="hidden rounded-sm border border-line px-1 font-mono text-[0.6875rem] text-muted sm:inline">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        aria-label="Cambiar de proyecto"
        className="mx-auto mt-[12dvh] w-[min(calc(100vw-2rem),560px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <div className="border-b border-line p-2">
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="project-switcher-list"
            aria-activedescendant={shown[active] ? `project-option-${shown[active].id}` : undefined}
            aria-label="Buscar proyecto"
            placeholder="Buscar proyecto por nombre, objetivo o carpeta"
            value={query}
            onChange={(e) => (setQuery(e.target.value), setActive(0))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((i) => Math.min(i + 1, shown.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => Math.max(i - 1, 0)));
              if (e.key === "Enter" && shown[active]) (e.preventDefault(), go(shown[active].id));
            }}
            className="min-h-11 w-full rounded-md bg-transparent px-3 text-ink placeholder:text-muted focus-visible:outline-none"
          />
        </div>
        <ul id="project-switcher-list" role="listbox" aria-label="Proyectos" className="max-h-[50dvh] overflow-y-auto p-1.5">
          {isPending && <li className="px-3 py-2 text-sm text-muted">Cargando proyectos...</li>}
          {!isPending && shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">Ningún proyecto coincide.</li>}
          {shown.map((p, i) => (
            <li
              key={p.id}
              id={`project-option-${p.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(p.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${i === active ? "bg-brand-soft" : ""}`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 truncate font-medium text-ink">
                  {p.name}
                  {p.id === projectId && <span className="text-xs font-normal text-muted">actual</span>}
                </span>
                <span className="truncate text-xs text-muted">{kindLabel(p.kind, p.platforms)}</span>
              </span>
              <span className="flex w-24 shrink-0 items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                  <span className={`block h-full rounded-full ${p.progress >= 100 ? "bg-ok" : "bg-brand"}`} style={{ width: `${p.progress}%` }} />
                </span>
                <span className="w-8 text-right text-xs text-muted tabular-nums">{p.progress}%</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          <span>Flechas para moverte, Enter para abrir</span>
          <button
            type="button"
            onClick={() => (setOpen(false), navigate({ to: "/projects/new" }))}
            className="rounded-sm font-medium text-brand hover:underline"
          >
            Nuevo proyecto
          </button>
        </div>
      </dialog>
    </>
  );
};

export default ProjectSwitcher;
