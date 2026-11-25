import { create } from "zustand";

/** One-off messages for a project page, set by work that finished elsewhere (the wizard, for example). */
type Notice = { tone: "info" | "warn"; text: string };

const useNoticeStore = create<{ notices: Record<string, Notice>; set: (projectId: string, notice: Notice | null) => void }>((set) => ({
  notices: {},
  set: (projectId, notice) =>
    set((s) => {
      const notices = { ...s.notices };
      if (notice) notices[projectId] = notice;
      else delete notices[projectId];
      return { notices };
    }),
}));

export default useNoticeStore;
