import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * The checkout the project page is looking at: null for the main one, or the path of a worktree.
 * It lives in the URL (?wt=), so it survives reloads and can be shared as a link.
 */
const useCheckoutView = (projectId: string) => {
  const { wt } = useSearch({ strict: false }) as { wt?: string };
  const navigate = useNavigate();
  const set = (path: string | null) =>
    navigate({
      to: "/projects/$projectId",
      params: { projectId },
      search: (prev: Record<string, unknown>) => ({ ...prev, wt: path ?? undefined }) as never,
      replace: true,
    });
  return { worktree: wt ?? null, set };
};

export default useCheckoutView;
