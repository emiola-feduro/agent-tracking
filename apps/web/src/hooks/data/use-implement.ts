import { useQuery } from "@tanstack/react-query";
import useAgentRuns from "@/hooks/data/use-agent-runs";
import { api, type ImplementItem, type LaunchBranch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useImplementStore, { readLaunchDefaults, saveLaunchDefaults, type LaunchDefaults } from "@/stores/use-implement-store";

/**
 * One click to hand tasks to an agent: it uses the options of the last launch on this project (or
 * Claude Code, safe permissions, the main checkout), and opens the options dialog only when no agent
 * is installed or the person asks for it.
 */
const useImplement = (projectId: string) => {
  const agents = useQuery({ queryKey: queryKeys.agents, queryFn: api.agents });
  const { launch } = useAgentRuns(projectId);
  const setNotice = useImplementStore((s) => s.setNotice);
  const openDialog = useImplementStore((s) => s.openDialog);
  const installed = (agents.data ?? []).filter((a) => a.installed);

  /** `instructions` and `branch` go with this run only; the other options are remembered. */
  const run = (items: ImplementItem[], options?: LaunchDefaults & { instructions?: string; branch?: LaunchBranch }, onDone?: () => void) => {
    const { instructions, branch, ...defaults }: LaunchDefaults & { instructions?: string; branch?: LaunchBranch } = options ?? readLaunchDefaults(projectId);
    const agent =
      installed.find((a) => a.kind === defaults.agent) ?? installed.find((a) => a.kind === "claude-code" && a.mcp) ?? installed.find((a) => a.mcp) ?? installed[0];
    if (!agent) return openDialog(items);
    saveLaunchDefaults(projectId, { ...defaults, agent: agent.kind });
    launch.mutate(
      {
        items,
        agent: agent.kind,
        cwd: defaults.cwd || undefined,
        permission: defaults.permission,
        model: defaults.model.trim() || undefined,
        instructions: instructions?.trim() || undefined,
        branch,
      },
      {
        onSuccess: (r) => (setNotice({ run: r, agentLabel: agent.label }), onDone?.()),
        onError: (e) => setNotice({ error: (e as Error).message }),
      },
    );
  };

  return { implement: run, options: openDialog, isLaunching: launch.isPending, ready: agents.isSuccess };
};

export default useImplement;
