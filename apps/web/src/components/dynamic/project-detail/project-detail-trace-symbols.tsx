import StatusPill from "@/components/ui/status-pill/status-pill";
import type { CodeSymbol } from "@/lib/api";
import { SYMBOL_KIND_LABEL } from "@/lib/labels";

const KIND_TONE = { function: "brand", class: "warn", type: "ok", constant: "neutral", variable: "neutral" } as const;

const lines = ({ lineStart, lineEnd }: CodeSymbol) =>
  lineStart == null ? null : lineEnd != null && lineEnd !== lineStart ? `${lineStart} a ${lineEnd}` : `${lineStart}`;

/** One row per function, type or constant in a file: name, kind, lines and what it is for. */
type ProjectDetailTraceSymbolsProps = {
  symbols: CodeSymbol[];
  /** Opens the code at the symbol's lines; missing when the code cannot be read here. */
  onShow?: (symbol: CodeSymbol) => void;
};

const ProjectDetailTraceSymbols = ({ symbols, onShow }: ProjectDetailTraceSymbolsProps) => {
  if (symbols.length === 0) return <p className="px-4 py-3 text-sm text-muted">Sin funciones ni tipos reportados en este archivo.</p>;

  return (
    <table className="w-full text-sm">
      <thead className="sr-only sm:not-sr-only">
        <tr className="text-left text-xs text-muted">
          <th className="px-4 pt-2.5 pb-1 font-medium">Nombre</th>
          <th className="px-2 pt-2.5 pb-1 font-medium">Tipo</th>
          <th className="px-2 pt-2.5 pb-1 font-medium">Líneas</th>
          <th className="px-4 pt-2.5 pb-1 font-medium">Para qué sirve</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line/70">
        {symbols.map((symbol) => (
          <tr key={symbol.id} className="flex animate-enter flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 sm:table-row sm:p-0">
            <td className="sm:px-4 sm:py-2">
              {onShow && symbol.lineStart != null ? (
                <button
                  type="button"
                  onClick={() => onShow(symbol)}
                  title="Ver en el código"
                  className="rounded-sm text-left font-mono text-[0.8125rem] font-medium break-all text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                >
                  {symbol.name}
                </button>
              ) : (
                <code className="font-mono text-[0.8125rem] font-medium break-all text-brand">{symbol.name}</code>
              )}
            </td>
            <td className="sm:px-2 sm:py-2">
              <StatusPill tone={KIND_TONE[symbol.kind as keyof typeof KIND_TONE] ?? "neutral"}>{SYMBOL_KIND_LABEL[symbol.kind]}</StatusPill>
            </td>
            <td className="font-mono text-xs whitespace-nowrap text-muted tabular-nums sm:px-2 sm:py-2">
              {lines(symbol) && <span aria-label={`líneas ${lines(symbol)}`}>{lines(symbol)}</span>}
            </td>
            <td className="w-full text-ink-soft sm:w-auto sm:px-4 sm:py-2">
              {symbol.purpose || <span className="text-muted">Detectado en el código, sin descripción</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ProjectDetailTraceSymbols;
