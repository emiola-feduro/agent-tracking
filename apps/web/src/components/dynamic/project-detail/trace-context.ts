import { createContext, useContext } from "react";

/** What file cards deep in the trace tree need: the project, and whether its code can be read here. */
export const TraceContext = createContext<{ projectId: string; canPreview: boolean; worktree?: string }>({ projectId: "", canPreview: false });
export const useTraceContext = () => useContext(TraceContext);
