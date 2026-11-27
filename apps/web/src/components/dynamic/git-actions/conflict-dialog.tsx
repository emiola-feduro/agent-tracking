import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import Modal from "@/components/ui/modal/modal";
import { api, type MergeSessionView } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type Props = { projectId: string; branch: string | null; onClose: () => void; onFinished: (branch: string) => void };

const Version = ({ title, text }: { title: string; text: string | null }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="text-xs font-medium text-muted">{title}</span>
    <pre className="max-h-56 min-h-16 overflow-auto rounded-md bg-subtle p-2 font-mono text-xs whitespace-pre text-ink">{text ?? "(borrado en este lado)"}</pre>
  </div>
);

/**
 * Brings main into a work branch and lets the person settle each conflicting file: keep the branch's
 * version, keep main's, or write the result. Nothing changes until "Terminar"; closing gives up.
 */
const ConflictDialog = ({ projectId, branch, onClose, onFinished }: Props) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<MergeSessionView | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: (b: string) => api.startMerge(projectId, b),
    onSuccess: (s) => (setSession(s), setCurrent(s.pending[0] ?? s.conflicts[0] ?? null)),
  });
  useEffect(() => {
    if (branch) {
      setSession(null);
      setCurrent(null);
      start.mutate(branch);
    }
  }, [branch]); // eslint-disable-line react-hooks/exhaustive-deps

  const file = useQuery({
    queryKey: ["merge", session?.id, current],
    queryFn: () => api.mergeFile(projectId, session!.id, current!),
    enabled: !!session && !!current,
    staleTime: 0,
  });
  useEffect(() => setDraft(null), [current]);
  const resolve = useMutation({
    mutationFn: (data: { take?: "branch" | "base"; content?: string }) => api.resolveMerge(projectId, session!.id, { path: current!, ...data }),
    onSuccess: (s) => {
      setSession(s);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["merge", s.id] });
      if (s.pending.length) setCurrent(s.pending[0]!);
    },
  });
  const finish = useMutation({
    mutationFn: () => api.finishMerge(projectId, session!.id),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches(projectId) });
      setSession(null);
      onFinished(r.branch);
    },
  });
  const close = () => {
    // Giving up: the throwaway merge is dropped, the branches stay as they were.
    if (session) void api.abortMerge(projectId, session.id).catch(() => {});
    setSession(null);
    onClose();
  };
  const error = (start.error ?? resolve.error ?? finish.error) as Error | null;

  return (
    <Modal
      open={!!branch}
      onClose={close}
      width={1040}
      title={`Resolver conflictos de ${branch ?? ""}`}
      description={
        session
          ? `Se trae ${session.base} a ${session.branch}. Elige qué queda en cada archivo; al terminar, ${session.branch} incluye ${session.base} y se puede integrar sin conflictos. Nada cambia hasta que termines.`
          : "Preparando la fusión aparte…"
      }
      footer={
        <>
          {session && (
            <p className="mr-auto text-sm text-muted">
              {session.pending.length ? `Faltan ${session.pending.length} de ${session.conflicts.length}` : "Todos resueltos"}
            </p>
          )}
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!session || session.pending.length > 0} isLoading={finish.isPending} onClick={() => finish.mutate()}>
            Terminar
          </Button>
        </>
      }
    >
      {error && <Alert>{error.message}</Alert>}
      {session && (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="flex flex-col gap-1" aria-label="Archivos en conflicto">
            {session.conflicts.map((path) => {
              const done = !session.pending.includes(path);
              return (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => setCurrent(path)}
                    aria-current={current === path}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm ${current === path ? "bg-brand-soft text-brand" : "hover:bg-subtle"}`}
                  >
                    <span aria-hidden className={done ? "text-ok" : "text-warn"}>
                      {done ? "✓" : "!"}
                    </span>
                    <code className="font-mono text-[0.8125rem] break-all">{path}</code>
                  </button>
                </li>
              );
            })}
          </ul>
          {current && file.data && (
            <div className="flex min-w-0 flex-col gap-3">
              {file.data.resolved && <p className="text-sm text-ok">Resuelto. Si hace falta, edita el resultado.</p>}
              {!file.data.resolved && (
                <div className="flex flex-col gap-3 md:flex-row">
                  <Version title={`Versión de ${session.branch}`} text={file.data.branch} />
                  <Version title={`Versión de ${session.base}`} text={file.data.base} />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={resolve.isPending || file.data.resolved} onClick={() => resolve.mutate({ take: "branch" })}>
                  Quedarme con {session.branch}
                </Button>
                <Button size="sm" disabled={resolve.isPending || file.data.resolved} onClick={() => resolve.mutate({ take: "base" })}>
                  Quedarme con {session.base}
                </Button>
                {draft === null && (
                  <Button size="sm" variant="ghost" onClick={() => setDraft(file.data!.merged)}>
                    Editar el resultado
                  </Button>
                )}
              </div>
              {draft !== null && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-ink" htmlFor="merge-draft">
                    Resultado de {current}
                  </label>
                  <p className="text-xs text-muted">Quita las marcas &lt;&lt;&lt;&lt;&lt;&lt;&lt;, ======= y &gt;&gt;&gt;&gt;&gt;&gt;&gt; y deja lo que debe quedar.</p>
                  <textarea
                    id="merge-draft"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    rows={14}
                    className="w-full rounded-md border border-line-strong bg-surface p-2 font-mono text-xs text-ink"
                  />
                  <span className="flex gap-2">
                    <Button size="sm" variant="primary" isLoading={resolve.isPending} onClick={() => resolve.mutate({ content: draft })}>
                      Guardar resultado
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                      Descartar edición
                    </Button>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ConflictDialog;
