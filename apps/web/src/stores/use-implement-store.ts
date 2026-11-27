import { create } from "zustand";
import type { AgentKind, AgentRun, ImplementItem, LaunchPermission } from "@/lib/api";

/** How the person last started an agent on this project: reused by the one-click "Implementar". */
export type LaunchDefaults = { agent: AgentKind | null; permission: LaunchPermission; model: string; cwd: string };

const KEY = (projectId: string) => `agent-tracking:launch:${projectId}`;
export const readLaunchDefaults = (projectId: string): LaunchDefaults => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY(projectId)) ?? "null") as Partial<LaunchDefaults> | null;
    return { agent: saved?.agent ?? null, permission: saved?.permission === "full" ? "full" : "safe", model: saved?.model ?? "", cwd: saved?.cwd ?? "" };
  } catch {
    return { agent: null, permission: "safe", model: "", cwd: "" };
  }
};
export const saveLaunchDefaults = (projectId: string, defaults: LaunchDefaults) => {
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(defaults));
  } catch {
    // Without storage the next click just uses the defaults again.
  }
};

type ImplementState = {
  /** Choosing several requirements and criteria to hand to one agent. */
  selecting: boolean;
  requirements: string[];
  /** Criterion id to its requirement id. */
  dod: Record<string, string>;
  /** The tasks the options dialog is open for (null: closed). */
  dialog: ImplementItem[] | null;
  /** Last result, shown briefly in the action bar. */
  notice: { run: AgentRun; agentLabel: string } | { error: string } | null;
  setSelecting: (on: boolean) => void;
  toggleRequirement: (id: string) => void;
  toggleDod: (dodId: string, requirementId: string) => void;
  clear: () => void;
  openDialog: (items: ImplementItem[]) => void;
  closeDialog: () => void;
  setNotice: (notice: ImplementState["notice"]) => void;
};

const useImplementStore = create<ImplementState>((set) => ({
  selecting: false,
  requirements: [],
  dod: {},
  dialog: null,
  notice: null,
  setSelecting: (selecting) => set(selecting ? { selecting } : { selecting, requirements: [], dod: {} }),
  // A whole requirement includes its criteria: picking it drops the ones picked one by one.
  toggleRequirement: (id) =>
    set((s) =>
      s.requirements.includes(id)
        ? { requirements: s.requirements.filter((x) => x !== id) }
        : { requirements: [...s.requirements, id], dod: Object.fromEntries(Object.entries(s.dod).filter(([, req]) => req !== id)) },
    ),
  toggleDod: (dodId, requirementId) =>
    set((s) => {
      const { [dodId]: had, ...rest } = s.dod;
      return had ? { dod: rest } : { dod: { ...s.dod, [dodId]: requirementId } };
    }),
  clear: () => set({ requirements: [], dod: {} }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  setNotice: (notice) => set({ notice }),
}));

/** The selection as tasks, in the order requirements and criteria appear on the page. */
export const selectionItems = (
  s: Pick<ImplementState, "requirements" | "dod">,
  requirements: { id: string }[],
  dod: { id: string; requirementId: string }[],
): ImplementItem[] =>
  requirements.flatMap((r) => {
    if (s.requirements.includes(r.id)) return [{ requirementId: r.id }];
    const dodIds = dod.filter((d) => d.requirementId === r.id && s.dod[d.id]).map((d) => d.id);
    return dodIds.length ? [{ requirementId: r.id, dodIds }] : [];
  });

export default useImplementStore;
