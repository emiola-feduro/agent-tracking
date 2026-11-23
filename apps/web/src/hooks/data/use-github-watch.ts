import { useEffect } from "react";
import { githubApi } from "@/lib/github-api";

const HEARTBEAT_MS = 60_000;

/** Tells the server this project is open so it polls GitHub and pushes live events. */
const useGithubWatch = (projectId: string, enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;
    const beat = () => void githubApi.watch(projectId).catch(() => {});
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [projectId, enabled]);
};

export default useGithubWatch;
