import { useState } from "react";
import Segmented from "@/components/ui/segmented/segmented";
import StatusPill from "@/components/ui/status-pill/status-pill";
import type { FileLink } from "@/hooks/data/use-traceability";
import type { CodeSymbol, FileArtifact } from "@/lib/api";
import { formatRelative } from "@/lib/activity";
import { INFERRED_ACTOR } from "@/lib/labels";
import ProjectDetailTraceCode from "./project-detail-trace-code";
import ProjectDetailTraceSymbols from "./project-detail-trace-symbols";
import { useTraceContext } from "./trace-context";

type ProjectDetailTraceFileProps = {
  file: FileArtifact;
  symbols: CodeSymbol[];
  open: boolean;
  onToggle: () => void;
  /** Requirement and feature the file belongs to, shown in the per file view. */
  links?: FileLink[];
  pending?: boolean;
};

const splitPath = (path: string) => {
  const at = path.lastIndexOf("/");
  return { dir: at >= 0 ? path.slice(0, at + 1) : "", base: at >= 0 ? path.slice(at + 1) : path };
};

const extension = (name: string) => {
  const at = name.lastIndexOf(".");
  return at > 0 ? name.slice(at + 1).slice(0, 4) : "";
};

/** A file as its own card: the header says what it is, the body lists its symbols. */
const ProjectDetailTraceFile = ({ file, symbols, open, onToggle, links, pending = false }: ProjectDetailTraceFileProps) => {
  const { id, path, purpose, createdBy, changedAt } = file;
  const { dir, base } = splitPath(path);
  const ext = extension(base);
  const panelId = `trace-file-${id}`;
  const { canPreview } = useTraceContext();
  const [tab, setTab] = useState<"symbols" | "code">(symbols.length > 0 ? "symbols" : "code");
  const [mark, setMark] = useState<{ start: number; end: number } | null>(null);
  // Without symbols nor a readable repository there is nothing more to show.
  const expandable = symbols.length > 0 || canPreview;
  const Header = expandable ? "button" : "div";

  return (
    <li className={`animate-enter overflow-hidden rounded-md border bg-surface ${pending ? "border-warn/50" : "border-line"}`}>
      <Header
        {...(expandable ? { type: "button" as const, "aria-expanded": open, "aria-controls": panelId, onClick: onToggle } : {})}
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left sm:px-4 ${expandable ? "transition-colors duration-150 hover:bg-subtle" : ""}`}
      >
        <span
          aria-hidden
          className="mt-0.5 grid h-6 w-9 shrink-0 place-items-center rounded-sm bg-brand-soft font-mono text-[0.625rem] font-semibold tracking-wide text-brand uppercase"
        >
          {ext || "file"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-mono text-[0.8125rem] break-all">
            <span className="text-muted">{dir}</span>
            <span className="font-semibold text-ink">{base}</span>
          </span>
          {purpose && <span className={`text-sm text-ink-soft ${open ? "" : "line-clamp-1"}`}>{purpose}</span>}
          {links && links.length > 0 && (
            <span className="flex flex-wrap gap-1.5 pt-1">
              {links.map(({ feature, requirement }) => (
                <span key={feature.id} className="text-xs text-muted">
                  {requirement ? <span className="text-ink-soft">{requirement.title}</span> : null}
                  {requirement ? " / " : ""}
                  {feature.name}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {pending && <StatusPill tone="warn">Sin reportar{changedAt ? `, ${formatRelative(changedAt)}` : ""}</StatusPill>}
          {!pending && links && links.length === 0 && <StatusPill>Sin feature</StatusPill>}
          {createdBy === INFERRED_ACTOR && !purpose && <StatusPill>Detectado</StatusPill>}
          {symbols.length > 0 && (
            <span className="hidden text-xs text-muted tabular-nums sm:inline">
              {symbols.length === 1 ? "1 símbolo" : `${symbols.length} símbolos`}
            </span>
          )}
          {expandable && (
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={`size-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          )}
        </span>
      </Header>
      {expandable && open && (
        <div id={panelId} className="animate-enter border-t border-line bg-canvas/50">
          {canPreview && symbols.length > 0 && (
            <div className="border-b border-line px-3 py-2 sm:px-4">
              <Segmented
                label={`Ver ${path}`}
                value={tab}
                onChange={(v) => (setTab(v), v === "symbols" && setMark(null))}
                items={[
                  { value: "symbols", label: `Símbolos (${symbols.length})` },
                  { value: "code", label: "Código" },
                ]}
              />
            </div>
          )}
          {tab === "symbols" && symbols.length > 0 ? (
            <ProjectDetailTraceSymbols
              symbols={symbols}
              onShow={
                canPreview
                  ? (s) => {
                      setMark({ start: s.lineStart!, end: s.lineEnd ?? s.lineStart! });
                      setTab("code");
                    }
                  : undefined
              }
            />
          ) : (
            <ProjectDetailTraceCode path={path} highlight={mark} />
          )}
        </div>
      )}
    </li>
  );
};

export default ProjectDetailTraceFile;
