import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
};

const PageHeader = ({ title, back, actions, children }: PageHeaderProps) => {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {back && (
        <Link to={back.to} className="w-fit rounded-sm text-sm text-muted transition-colors hover:text-ink">
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export default PageHeader;
