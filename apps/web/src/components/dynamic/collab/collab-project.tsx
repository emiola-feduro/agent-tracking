import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import { useCollabConnection, useCollabDisconnect, useCollabPresence, useCollabStatus, useCollabSync } from "@/hooks/data/use-collab";
import { roleLabel } from "@/lib/collab-api";
import CollabConnect from "./collab-connect";
import CollabMembers from "./collab-members";

const syncMessage = (r: { pulled: boolean; pushed: boolean; revision: number }) =>
  r.pulled && r.pushed
    ? `Se trajeron cambios del equipo y se enviaron los tuyos (versión ${r.revision}).`
    : r.pulled
      ? `Se trajeron cambios del equipo (versión ${r.revision}).`
      : r.pushed
        ? `Se enviaron tus cambios (versión ${r.revision}).`
        : `Todo al día (versión ${r.revision}).`;

/**
 * Collaboration on a project: connection to the shared server, sharing and syncing, who is working
 * on it right now, and the members with their roles.
 */
const CollabProject = ({ projectId }: { projectId: string }) => {
  const { data: conn, status: connStatus } = useCollabConnection();
  const connected = !!conn?.connected;
  const { data: status, error: statusError } = useCollabStatus(projectId, connected);
  const shared = !!status?.shared;
  const { data: presence = [] } = useCollabPresence(projectId, shared);
  const sync = useCollabSync(projectId);
  const disconnect = useCollabDisconnect();

  if (connStatus === "pending") return <p className="text-muted">Cargando colaboración...</p>;
  if (!connected || !conn?.user) return <CollabConnect />;
  const behind = status?.revision != null && status.syncedRevision !== status.revision;

  return (
    <>
      <section aria-labelledby="collab-server" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="collab-server" className="text-lg font-semibold text-ink">
              Servidor compartido
            </h2>
            <p className="text-sm break-all text-muted">
              {conn.user.name} ({conn.user.email}) en {conn.url}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => disconnect.mutate()} isLoading={disconnect.isPending}>
            Desconectar
          </Button>
        </div>
        {statusError && <Alert>{statusError.message}</Alert>}
        {status && !shared && (
          <div className="flex flex-col gap-3">
            <p className="text-ink-soft">Este proyecto todavía no está en el servidor. Al compartirlo quedas como responsable y puedes sumar personas.</p>
            <Button variant="primary" className="self-start" isLoading={sync.isPending} onClick={() => sync.mutate({ share: true })}>
              Compartir proyecto
            </Button>
          </div>
        )}
        {shared && status && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-ink-soft">
              Tu rol: <span className="font-medium text-ink">{roleLabel(status.role!)}</span>
            </p>
            <p className="text-ink-soft">
              Versión del servidor: <span className="font-medium text-ink tabular-nums">{status.revision}</span>
              {behind && <span className="text-warn"> (hay cambios sin traer)</span>}
            </p>
            <Button variant="primary" className="ml-auto" isLoading={sync.isPending} onClick={() => sync.mutate({ share: false })}>
              Sincronizar
            </Button>
          </div>
        )}
        {shared && status?.role === "viewer" && <p className="text-sm text-muted">Con rol de lectura recibes los cambios del equipo, pero los tuyos no se envían.</p>}
        {sync.isSuccess && <Alert tone="info">{syncMessage(sync.data)}</Alert>}
        {sync.isError && <Alert>{sync.error.message}</Alert>}
      </section>
      {shared && (
        <section aria-labelledby="collab-presence" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
          <h2 id="collab-presence" className="text-lg font-semibold text-ink">
            Trabajando ahora
          </h2>
          {presence.length === 0 ? (
            <p className="text-muted">Nadie más tiene el proyecto abierto.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {presence.map((p) => (
                <li key={p.userId} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-ink">
                  <span aria-hidden className="size-2 rounded-full bg-ok" />
                  {p.name}
                  {p.userId === conn.user!.id && <span className="text-muted">(tú)</span>}
                  {p.activity && <span className="text-muted">{p.activity}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {shared && <CollabMembers projectId={projectId} myId={conn.user.id} isOwner={status?.role === "owner"} />}
    </>
  );
};

export default CollabProject;
