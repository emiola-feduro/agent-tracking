import { Link, Outlet } from "@tanstack/react-router";
import useLiveEvents from "@/hooks/data/use-live-events";

const AppShell = () => {
  useLiveEvents();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 rounded-md font-semibold text-ink">
            <img src="/logo.svg" alt="" width={26} height={26} />
            Agent Tracking
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24">
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
