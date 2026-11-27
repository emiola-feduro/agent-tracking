import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type IntegrateResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type IntegrateOutcome = { branch: string; tone: "info" | "warn" | "danger"; text: string };

/** What integrating did, in one or two sentences. */
export const describeIntegration = (r: IntegrateResult): IntegrateOutcome => {
  const how =
    r.merge === "already-merged" ? `${r.branch} ya estaba en ${r.base}` : r.merge === "fast-forward" ? `${r.branch} quedó en ${r.base}` : `${r.branch} se fusionó en ${r.base} con un commit de fusión`;
  const extra = [
    r.trackingCommits.length ? "Antes se guardaron los datos de Agent Tracking que estaban sin commit." : "",
    r.switchedBack ? `Tu checkout volvió a ${r.base}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (r.pushError) return { branch: r.branch, tone: "warn", text: `${how} en este equipo, pero no se subió. ${r.pushError} ${extra}`.trim() };
  return { branch: r.branch, tone: "info", text: `${how}${r.pushed ? ` y se subió a origin/${r.base}` : ""}. ${extra}`.trim() };
};

/**
 * Brings a work branch into the main one (and pushes it), after a confirmation that says what will
 * happen; the result or the git problem is kept in `outcome` to show next to the button.
 */
const useIntegrate = (projectId: string, base: string) => {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<IntegrateOutcome | null>(null);
  const mutation = useMutation({
    mutationFn: ({ branch, push }: { branch: string; push: boolean }) => api.integrateBranch(projectId, branch, push),
    onSuccess: (r) => setOutcome(describeIntegration(r)),
    onError: (e, { branch }) => setOutcome({ branch, tone: "danger", text: (e as Error).message }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.worktrees(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
  const integrate = (branch: string, push: boolean, commits?: number) => {
    const what = commits ? `${branch} (${commits === 1 ? "1 commit" : `${commits} commits`})` : branch;
    if (!confirm(push ? `¿Integrar ${what} en ${base} y subirla a origin?` : `¿Integrar ${what} en ${base} solo en este equipo?`)) return;
    setOutcome(null);
    mutation.mutate({ branch, push });
  };
  return { integrate, outcome, clearOutcome: () => setOutcome(null), busyBranch: mutation.isPending ? mutation.variables?.branch : null, isPending: mutation.isPending };
};

export default useIntegrate;
