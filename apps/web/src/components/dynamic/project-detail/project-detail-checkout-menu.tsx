import { useEffect, useRef, useState } from "react";
import { useCheckout, useLocalBranches, useWorktrees } from "@/hooks/data/use-worktrees";
import useCheckoutView from "@/hooks/ui/use-checkout-view";

const shortPath = (path: string) => path.replace(/^\/home\/[^/]+|^\/Users\/[^/]+/, "~");
const lastPart = (path: string) => path.split("/").filter(Boolean).pop() ?? path;

/**
 * Switch the branch of the main checkout, or look at another worktree, from one menu. Git's rules
 * are said up front: with uncommitted changes the branch cannot change, and a branch open in a
 * worktree can only be looked at there.
 */
const ProjectDetailCheckoutMenu = ({ projectId }: { projectId: string }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const branches = useLocalBranches(projectId);
  const worktrees = useWorktrees(projectId);
  const checkout = useCheckout(projectId);
  const view = useCheckoutView(projectId);
  const list = worktrees.data?.worktrees ?? [];
  const viewed = view.worktree ? list.find((w) => w.path === view.worktree) : null;
  const dirty = branches.data?.dirty ?? [];
  const openIn = new Map(list.filter((w) => !w.main && w.branch).map((w) => [w.branch!, w.path]));
  const label = viewed ? (viewed.branch ?? "HEAD separado") : (branches.data?.current ?? "Sin rama");

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const switchTo = (branch: string) => {
    checkout.mutate(branch, { onSuccess: () => setOpen(false) });
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm transition-colors duration-150 hover:bg-subtle"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6 3v10M6 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM14 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 7c0 4-8 3-8 6" />
        </svg>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-mono text-[0.8125rem] text-ink">{label}</span>
          <span className="truncate text-xs text-muted">{viewed ? `worktree ${lastPart(viewed.path)}` : "checkout principal"}</span>
        </span>
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-[min(calc(100vw-2rem),22rem)] animate-enter overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="max-h-[70dvh] overflow-y-auto py-1">
            <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Ramas del checkout principal</p>
            {dirty.length > 0 && (
              <p className="mx-3 mb-1 rounded-md bg-warn-soft px-2.5 py-2 text-xs text-warn">
                Hay {dirty.length === 1 ? "1 archivo" : `${dirty.length} archivos`} con cambios sin commit ({dirty.slice(0, 3).join(", ")}
                {dirty.length > 3 ? "..." : ""}). Git no deja cambiar de rama hasta que hagas commit o los descartes.
              </p>
            )}
            {checkout.isError && <p className="mx-3 mb-1 rounded-md bg-danger-soft px-2.5 py-2 text-xs text-danger">{(checkout.error as Error).message}</p>}
            <ul>
              {branches.data?.branches.map((b) => {
                const elsewhere = openIn.get(b.name);
                const current = b.current && !viewed;
                return (
                  <li key={b.name}>
                    <button
                      type="button"
                      disabled={b.current ? !viewed : !elsewhere && dirty.length > 0}
                      onClick={() => {
                        if (b.current) view.set(null);
                        else if (elsewhere) view.set(elsewhere);
                        else switchTo(b.name);
                        if (b.current || elsewhere) setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent ${current ? "bg-brand-soft" : ""}`}
                    >
                      <span className="w-4 shrink-0 text-brand">{current ? "✓" : ""}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-ink">{b.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {checkout.isPending && checkout.variables === b.name
                          ? "Cambiando..."
                          : b.current
                            ? "actual"
                            : elsewhere
                              ? `en worktree ${lastPart(elsewhere)}`
                              : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {list.length > 1 && (
              <>
                <p className="mt-1 border-t border-line px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Worktrees</p>
                <ul>
                  {list.map((w) => {
                    const active = w.main ? !viewed : viewed?.path === w.path;
                    const p = w.progress;
                    return (
                      <li key={w.path}>
                        <button
                          type="button"
                          disabled={w.prunable}
                          onClick={() => {
                            view.set(w.main ? null : w.path);
                            setOpen(false);
                          }}
                          className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-subtle disabled:opacity-50 ${active ? "bg-brand-soft" : ""}`}
                        >
                          <span className="w-4 shrink-0 pt-0.5 text-brand">{active ? "✓" : ""}</span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-mono text-[0.8125rem] text-ink">{w.branch ?? "HEAD separado"}</span>
                            <span className="truncate text-xs text-muted" title={w.path}>
                              {w.main ? "checkout principal" : shortPath(w.path)}
                            </span>
                          </span>
                          {p && !w.main && (
                            <span className="shrink-0 text-right text-xs text-muted tabular-nums">
                              {p.ahead > 0 && <span className="block">{p.ahead} adelante</span>}
                              {p.dirty > 0 && <span className="block text-warn">{p.dirty} sin commit</span>}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailCheckoutMenu;
