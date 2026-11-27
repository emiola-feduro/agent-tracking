import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Button from "@/components/ui/button/button";
import CheckOption from "@/components/ui/check-option/check-option";
import Modal from "@/components/ui/modal/modal";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const STATUS_LABEL: Record<string, string> = {
  added: "nuevo",
  untracked: "nuevo",
  modified: "modificado",
  deleted: "borrado",
  renamed: "renombrado",
  copied: "copiado",
  typechange: "tipo cambiado",
  unmerged: "en conflicto",
};

type Props = { projectId: string; open: boolean; onClose: () => void; onDone?: () => void; worktree?: string | null; where?: string };

/** Commits uncommitted files of a checkout: pick them, write the message, done. */
const CommitDialog = ({ projectId, open, onClose, onDone, worktree = null, where }: Props) => {
  const queryClient = useQueryClient();
  const changes = useQuery({ queryKey: ["projects", projectId, "working-changes", worktree], queryFn: () => api.workingChanges(projectId, worktree), enabled: open });
  const files = (changes.data?.files ?? []).filter((f) => f.status !== "unmerged");
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open) return;
    setPicked((changes.data?.files ?? []).filter((f) => f.status !== "unmerged").map((f) => f.path));
  }, [open, changes.data]);
  useEffect(() => {
    if (open) setMessage("");
  }, [open]);
  const commit = useMutation({
    mutationFn: () => api.commit(projectId, { worktree, message, paths: picked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches(projectId) });
      onDone?.();
      onClose();
    },
  });
  const onlyTracking = picked.length > 0 && picked.every((p) => p.startsWith(".agent-tracking/"));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hacer commit"
      description={where ? `Cambios sin commit en ${where}.` : "Cambios sin commit del checkout principal."}
      footer={
        <>
          {commit.isError && <p className="mr-auto text-sm text-danger">{(commit.error as Error).message}</p>}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!picked.length || !message.trim()} isLoading={commit.isPending} onClick={() => commit.mutate()}>
            Hacer commit {picked.length ? `(${picked.length})` : ""}
          </Button>
        </>
      }
    >
      {changes.isPending && <p className="text-sm text-muted">Leyendo los cambios…</p>}
      {changes.isSuccess && files.length === 0 && <p className="text-sm text-muted">No hay cambios sin commit.</p>}
      {files.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 flex w-full items-center justify-between text-sm font-medium text-ink">
            Archivos
            <button
              type="button"
              className="text-sm font-normal text-brand hover:underline"
              onClick={() => setPicked(picked.length === files.length ? [] : files.map((f) => f.path))}
            >
              {picked.length === files.length ? "Ninguno" : "Todos"}
            </button>
          </legend>
          <div className="max-h-72 overflow-y-auto rounded-md border border-line p-1">
            {files.map((f) => (
              <CheckOption
                key={f.path}
                checked={picked.includes(f.path)}
                onChange={() => setPicked((s) => (s.includes(f.path) ? s.filter((x) => x !== f.path) : [...s, f.path]))}
                label={<code className="font-mono text-[0.8125rem] break-all">{f.path}</code>}
                meta={<span className="text-xs text-muted">{STATUS_LABEL[f.status] ?? f.status}</span>}
              />
            ))}
          </div>
        </fieldset>
      )}
      <TextAreaField
        label="Mensaje del commit"
        value={message}
        onChange={setMessage}
        rows={3}
        placeholder={onlyTracking ? "chore: actualiza los datos de Agent Tracking" : "feat: describe lo que cambia"}
      />
      {onlyTracking && !message && (
        <button type="button" className="self-start text-sm text-brand hover:underline" onClick={() => setMessage("chore: update Agent Tracking data")}>
          Usar «chore: update Agent Tracking data»
        </button>
      )}
    </Modal>
  );
};

export default CommitDialog;
