import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import Skeleton from "@/components/ui/skeleton/skeleton";
import useGithubStatus from "@/hooks/data/use-github-status";
import { AUTH_SOURCE } from "@/lib/github-labels";
import { relativeTime } from "@/lib/relative-time";

/** Connection state: how to connect when anonymous, and the remaining rate limit. */
const GithubConnection = () => {
  const { status, refresh } = useGithubStatus();

  if (status.isPending) return <Skeleton className="h-4 w-64" />;
  if (status.isError) return null;

  const { auth, rateLimit } = status.data;
  const quota = rateLimit && (
    <span className="tabular-nums">
      {rateLimit.remaining} de {rateLimit.limit} consultas restantes
      {rateLimit.remaining === 0 && `, se renueva ${relativeTime(rateLimit.resetAt)}`}
    </span>
  );

  if (auth.kind === "anonymous") {
    return (
      <Alert
        tone="info"
        action={
          <Button size="sm" isLoading={refresh.isPending} onClick={() => refresh.mutate()}>
            Volver a comprobar
          </Button>
        }
      >
        <p className="font-medium">Sin cuenta de GitHub conectada</p>
        <p className="mt-1 text-ink-soft">
          Solo se ven repositorios públicos, con 60 consultas por hora. Para conectar tu cuenta ejecuta{" "}
          <code className="font-mono text-[0.8125rem]">gh auth login</code> o define la variable{" "}
          <code className="font-mono text-[0.8125rem]">GITHUB_TOKEN</code> antes de iniciar el servidor.
        </p>
        {quota && <p className="mt-1 text-ink-soft">{quota}</p>}
      </Alert>
    );
  }

  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <span>Conectado con {AUTH_SOURCE[auth.source] ?? auth.source}</span>
      {quota}
    </p>
  );
};

export default GithubConnection;
