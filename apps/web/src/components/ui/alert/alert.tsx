import type { ReactNode } from "react";

type AlertProps = {
  tone?: "danger" | "warn" | "info";
  children: ReactNode;
  action?: ReactNode;
};

const toneClasses = {
  danger: "border-danger bg-danger-soft text-danger",
  warn: "border-warn bg-warn-soft text-warn",
  info: "border-brand bg-brand-soft text-brand",
};

const Alert = ({ tone = "danger", children, action }: AlertProps) => {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex animate-enter flex-wrap items-center justify-between gap-3 rounded-md border-l-4 px-4 py-3 text-sm ${toneClasses[tone]}`}
    >
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
};

export default Alert;
