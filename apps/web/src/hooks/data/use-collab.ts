import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collabApi, type CollabRole } from "@/lib/collab-api";
import { queryKeys } from "@/lib/query-keys";

/** How often this person tells the shared server they are on the project (it forgets after a minute). */
const HEARTBEAT_MS = 25_000;

/** The connection to the shared server, if any. */
export const useCollabConnection = () => useQuery({ queryKey: queryKeys.collab, queryFn: collabApi.connection });

export const useCollabConnect = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: collabApi.connect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.collab }),
  });
};

export const useCollabDisconnect = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: collabApi.disconnect,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.collab });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};

/** Projects shared with this person on the server. */
export const useSharedProjects = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.collabProjects, queryFn: collabApi.sharedProjects, enabled, select: (d) => d.projects });

export const useJoinProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, repoPath }: { projectId: string; repoPath: string }) => collabApi.join(projectId, repoPath),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
};

/** Whether the project is shared, this person's role and how far behind this machine is. */
export const useCollabStatus = (projectId: string, enabled: boolean) =>
  useQuery({ queryKey: queryKeys.collabStatus(projectId), queryFn: () => collabApi.status(projectId), enabled, retry: false });

export const useCollabSync = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ share }: { share: boolean }) => (share ? collabApi.share(projectId) : collabApi.sync(projectId)),
    // The project's prefix covers the snapshot, the status and the members.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
  });
};

export const useCollabMembers = (projectId: string, enabled: boolean) =>
  useQuery({ queryKey: queryKeys.collabMembers(projectId), queryFn: () => collabApi.members(projectId), enabled, select: (d) => d.members });

export const useCollabMemberActions = (projectId: string) => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.collabMembers(projectId) });
  return {
    setMember: useMutation({
      mutationFn: ({ email, role }: { email: string; role: CollabRole }) => collabApi.setMember(projectId, email, role),
      onSettled: refresh,
    }),
    removeMember: useMutation({ mutationFn: (userId: string) => collabApi.removeMember(projectId, userId), onSettled: refresh }),
  };
};

/** Sends a heartbeat while the project is open and returns who else is working on it. */
export const useCollabPresence = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.collabPresence(projectId),
    queryFn: () => collabApi.heartbeat(projectId),
    enabled,
    refetchInterval: HEARTBEAT_MS,
    select: (d) => d.presence,
    retry: false,
  });
