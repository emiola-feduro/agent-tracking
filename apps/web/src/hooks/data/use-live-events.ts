import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";

type LiveEvent = { type: string; projectId: string };

/** Keeps the cache in sync with server events (agents, teammates, other tabs). Reconnects on drop. */
const useLiveEvents = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.onmessage = (message) => {
        let event: LiveEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        // Agent steps arrive many times a minute and change nothing stored.
        if (event.type === "live") {
          queryClient.invalidateQueries({ queryKey: queryKeys.live(event.projectId) });
          return;
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true });
        // A deleted project's page handles its own exit; refetching it would only produce a 404.
        if (event.type !== "project.deleted") {
          queryClient.invalidateQueries({ queryKey: queryKeys.project(event.projectId) });
        }
      };
      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [queryClient]);
};

export default useLiveEvents;
