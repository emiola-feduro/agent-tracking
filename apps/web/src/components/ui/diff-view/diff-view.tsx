import { useMemo, useState } from "react";
import type { DiffFile } from "@/lib/api";
import { parsePatch } from "@/lib/diff";

type DiffViewProps = {
  patch: string;
  files: DiffFile[];
  truncated?: boolean;
  /** Files start open when there are this many or fewer. */
  openUpTo?: number;
};

const ROW = { add: "bg-ok/12", del: "bg-danger/12", ctx: "", hunk: "bg-subtle text-muted", meta: "text-muted italic" } as const;
const SIGN = { add: "+", del: "-", ctx: " ", hunk: "", meta: "" } as const;

/** One collapsible block per file with +/- counts, in the order git reports them. */
const DiffView = ({ patch, files, truncated = false, openUpTo = 3 }: DiffViewProps) => {
  const parsed = useMemo(() => parsePatch(patch), [patch]);
  const [open, setOpen] = useState(() => new Set(files.length <= openUpTo ? files.map((f) => f.path) : []));
  const toggle = (path: string) => setOpen((s) => (s.has(path) ? (s.delete(path), new Set(s)) : new Set(s).add(path)));

  if (files.length === 0) return <p className="text-sm text-muted">No hubo cambios en los archivos.</p>;

  return (
    <div className="flex flex-col gap-2">
      {files.map((f) => {
        const body = parsed.find((p) => p.path === f.path);
        const isOpen = open.has(f.path);
        return (
          <section key={f.path} className="overflow-hidden rounded-md border border-line bg-surface">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(f.path)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-subtle"
            >
              <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-ink">{f.path}</code>
              {f.binary ? (
                <span className="text-xs text-muted">binario</span>
              ) : (
                <span className="font-mono text-xs tabular-nums">
                  <span className="text-ok">+{f.insertions}</span> <span className="text-danger">-{f.deletions}</span>
                </span>
              )}
              <svg aria-hidden viewBox="0 0 16 16" className={`size-4 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>
            {isOpen && (
              <div className="max-h-[32rem] overflow-auto border-t border-line font-mono text-[0.8125rem] leading-6 [font-variant-ligatures:none]">
                {!body || body.lines.length === 0 ? (
                  <p className="px-3 py-2 font-sans text-sm text-muted">{f.binary ? "Archivo binario." : "Sin líneas para mostrar."}</p>
                ) : (
                  <table className="w-full border-collapse">
                    <tbody>
                      {body.lines.map((l, i) => (
                        <tr key={i} className={ROW[l.kind]}>
                          <td className="w-[1%] px-2 text-right text-muted select-none tabular-nums">{l.oldNo ?? ""}</td>
                          <td className="w-[1%] border-r border-line px-2 text-right text-muted select-none tabular-nums">{l.newNo ?? ""}</td>
                          <td className="px-3 whitespace-pre text-ink">
                            <span aria-hidden className={`select-none ${l.kind === "add" ? "text-ok" : l.kind === "del" ? "text-danger" : ""}`}>
                              {SIGN[l.kind]}
                            </span>
                            {l.kind === "hunk" ? <span className="font-sans text-xs">{l.text || "..."}</span> : l.text || "​"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}
      {truncated && <p className="text-xs text-muted">El diff es muy grande: se muestra solo una parte.</p>}
    </div>
  );
};

export default DiffView;
