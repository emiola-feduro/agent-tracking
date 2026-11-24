import type { CodeSymbol, FileArtifact } from "@/lib/api";
import { SYMBOL_KIND_LABEL } from "@/lib/labels";

type ProjectDetailTraceFileProps = {
  file: FileArtifact;
  symbols: CodeSymbol[];
};

const lines = ({ lineStart, lineEnd }: CodeSymbol) =>
  lineStart == null ? null : lineEnd != null && lineEnd !== lineStart ? `líneas ${lineStart} a ${lineEnd}` : `línea ${lineStart}`;

const ProjectDetailTraceFile = ({ file, symbols }: ProjectDetailTraceFileProps) => {
  const { path, purpose } = file;

  return (
    <li className="flex animate-enter flex-col gap-1.5">
      <code className="font-mono text-[13px] text-ink break-all">{path}</code>
      {purpose && <p className="text-sm text-ink-soft">{purpose}</p>}
      {symbols.length > 0 && (
        <ul className="flex flex-col gap-1 pt-0.5">
          {symbols.map((symbol) => (
            <li key={symbol.id} className="flex animate-enter flex-wrap items-baseline gap-x-2 text-sm">
              <code className="font-mono text-[13px] text-brand">{symbol.name}</code>
              <span className="text-muted">{SYMBOL_KIND_LABEL[symbol.kind]}</span>
              {lines(symbol) && <span className="text-muted tabular-nums">{lines(symbol)}</span>}
              {symbol.purpose && <span className="text-ink-soft">{symbol.purpose}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export default ProjectDetailTraceFile;
