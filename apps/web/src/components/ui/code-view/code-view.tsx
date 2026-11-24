import { useEffect, useMemo, useRef } from "react";
import { highlightLine } from "@/lib/highlight";

type CodeViewProps = {
  code: string;
  /** File extension, for comment syntax. */
  language: string;
  /** 1-based inclusive range to mark and scroll to. */
  highlight?: { start: number; end: number } | null;
  label: string;
};

const TONE = { comment: "text-muted italic", string: "text-ok", keyword: "text-brand font-medium", number: "text-warn" } as const;

/** Read-only code with line numbers; a highlighted range is scrolled into view. */
const CodeView = ({ code, language, highlight, label }: CodeViewProps) => {
  const box = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const width = String(lines.length).length;

  useEffect(() => {
    if (!highlight || !box.current) return;
    const row = box.current.querySelector<HTMLElement>(`[data-line="${highlight.start}"]`);
    if (row) box.current.scrollTo({ top: row.offsetTop - 48, behavior: "smooth" });
  }, [highlight]);

  return (
    <div ref={box} role="region" aria-label={label} tabIndex={0} className="relative max-h-[28rem] overflow-auto bg-surface font-mono text-[0.8125rem] leading-6 [font-variant-ligatures:none]">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => {
            const n = i + 1;
            const marked = highlight && n >= highlight.start && n <= highlight.end;
            return (
              <tr key={n} data-line={n} className={marked ? "bg-brand-soft" : undefined}>
                <td
                  className={`sticky left-0 border-r border-line px-3 text-right align-top text-muted select-none tabular-nums ${marked ? "bg-brand-soft" : "bg-surface"}`}
                  style={{ width: `${width + 2}ch` }}
                >
                  {n}
                </td>
                <td className="px-3 whitespace-pre text-ink">
                  {highlightLine(line, language).map((t, j) => (
                    <span key={j} className={t.kind ? TONE[t.kind] : undefined}>
                      {t.text}
                    </span>
                  ))}
                  {line === "" && "​"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CodeView;
