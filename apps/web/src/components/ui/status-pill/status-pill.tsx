import type { ReactNode } from "react";

type StatusPillProps = {
  tone?: "neutral" | "brand" | "ok" | "warn" | "danger";
  children: ReactNode;
};

const toneClasses = {
  neutral: "bg-subtle text-ink-soft",
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

const StatusPill = ({ tone = "neutral", children }: StatusPillProps) => {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
};

export default StatusPill;
