import { parseRequirements, REQUIREMENT_AREA_LABEL, REQUIREMENT_TYPE_LABEL, REQUIREMENTS_TEMPLATE, type ImportedRequirement, type ProjectKind } from "@agent-tracking/core";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/button/button";

type RequirementsImportDialogProps = {
  open: boolean;
  onClose: () => void;
  kind: ProjectKind;
  /** Receives what was read; resolves when it was saved. */
  onImport: (text: string, requirements: ImportedRequirement[]) => Promise<unknown> | void;
  busy?: boolean;
  error?: string | null;
};

const JSON_EXAMPLE = `[
  {
    "title": "Registrar gastos",
    "description": "POST /expenses con monto y categoría",
    "type": "funcional",
    "area": "backend",
    "dod": ["Un monto negativo devuelve 400", "Responde 201 con el gasto"]
  }
]`;

/**
 * Paste or open a Markdown or JSON file with requirements and their Definition of Done. The preview
 * updates while typing and shows what Agent Tracking understood, including inferred type and area.
 */
const RequirementsImportDialog = ({ open, onClose, kind, onImport, busy = false, error }: RequirementsImportDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseRequirements(text, kind) : null), [text, kind]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const submit = async () => {
    if (!parsed?.ok) return;
    await onImport(text, parsed.value);
    setText("");
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="import-title"
      className="m-auto max-h-[92dvh] w-[min(calc(100vw-2rem),1000px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="import-title" className="text-lg font-semibold">
            Importar requerimientos
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </header>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="import-text" className="text-sm font-medium">
                Pega Markdown o JSON
              </label>
              <div className="flex gap-2">
                <input
                  ref={file}
                  type="file"
                  accept=".md,.markdown,.txt,.json,text/markdown,application/json,text/plain"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setText(await f.text());
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant="ghost" onClick={() => file.current?.click()}>
                  Abrir archivo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setText(REQUIREMENTS_TEMPLATE)}>
                  Usar ejemplo
                </Button>
              </div>
            </div>
            <textarea
              id="import-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              spellCheck={false}
              placeholder={"## Título del requerimiento [funcional, backend]\nDescripción opcional.\n\n- [ ] Criterio del Definition of Done"}
              className="min-h-64 w-full flex-1 resize-y rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-[0.8125rem] leading-relaxed text-ink placeholder:text-muted"
            />
            <details className="text-sm text-ink-soft">
              <summary className="w-fit cursor-pointer font-medium text-brand">Cómo se escribe</summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                <li>
                  Un título por requerimiento (<code className="font-mono">## Título</code>). Lo que va debajo en texto es la descripción.
                </li>
                <li>Las listas o checklists debajo del título son los criterios del Definition of Done.</li>
                <li>
                  Tipo y área van entre corchetes al final del título, <code className="font-mono">[no funcional, seguridad]</code>, o en líneas{" "}
                  <code className="font-mono">Tipo:</code> y <code className="font-mono">Área:</code>. Si faltan, se deducen del texto.
                </li>
                <li>En JSON, una lista de objetos así:</li>
              </ul>
              <pre className="mt-2 overflow-x-auto rounded-md bg-subtle p-3 font-mono text-xs">{JSON_EXAMPLE}</pre>
            </details>
          </div>
          <div className="flex min-w-0 flex-col gap-3" aria-live="polite">
            <h3 className="text-sm font-medium">Vista previa</h3>
            {!parsed && <p className="text-sm text-muted">Aquí verás lo que Agent Tracking entiende de tu texto.</p>}
            {parsed && !parsed.ok && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{parsed.error}</p>}
            {parsed?.ok && (
              <>
                {parsed.warnings.map((w) => (
                  <p key={w} className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
                    {w}
                  </p>
                ))}
                <ol className="flex flex-col gap-2">
                  {parsed.value.map((r, i) => (
                    <li key={i} className="rounded-md border border-line p-3">
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${r.type === "functional" ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn"}`}>
                          {REQUIREMENT_TYPE_LABEL[r.type]}
                        </span>
                        <span className="rounded-full bg-subtle px-2 py-0.5 text-ink-soft">{REQUIREMENT_AREA_LABEL[r.area]}</span>
                      </p>
                      {r.description && <p className="mt-1.5 text-sm text-ink-soft">{r.description}</p>}
                      {r.dod.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-0.5 text-sm text-ink">
                          {r.dod.map((d, j) => (
                            <li key={j} className="flex gap-2">
                              <span aria-hidden className="text-muted">
                                ☐
                              </span>
                              {d}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!parsed?.ok} isLoading={busy} onClick={submit}>
            {parsed?.ok ? `Importar ${parsed.value.length === 1 ? "1 requerimiento" : `${parsed.value.length} requerimientos`}` : "Importar"}
          </Button>
        </footer>
      </div>
    </dialog>
  );
};

export default RequirementsImportDialog;
