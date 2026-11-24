import { Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import AppearanceDialog from "@/components/dynamic/appearance/appearance-dialog";
import ProjectSwitcher from "@/components/dynamic/project-switcher/project-switcher";
import useLiveEvents from "@/hooks/data/use-live-events";
import useApplyAppearance from "@/hooks/ui/use-apply-appearance";

const AppShell = () => {
  useLiveEvents();
  useApplyAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex shrink-0 items-center gap-2 rounded-md font-semibold text-ink">
              <img src="/logo.svg" alt="" width={26} height={26} />
              <span className="hidden sm:inline">Agent Tracking</span>
            </Link>
            <ProjectSwitcher />
          </div>
          <button
            type="button"
            onClick={() => setAppearanceOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-subtle hover:text-ink"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2.5a7.5 7.5 0 1 0 0 15c1 0 1.6-.8 1.3-1.7-.3-.9.3-1.8 1.3-1.8h1.6a3.3 3.3 0 0 0 3.3-3.3C17.5 5.6 14.1 2.5 10 2.5Z" />
              <circle cx="6.3" cy="9.2" r="1" fill="currentColor" stroke="none" />
              <circle cx="9.2" cy="6" r="1" fill="currentColor" stroke="none" />
              <circle cx="13.3" cy="7" r="1" fill="currentColor" stroke="none" />
            </svg>
            Apariencia
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24">
        <Outlet />
      </main>
      <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </div>
  );
};

export default AppShell;
