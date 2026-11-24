import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import { ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";

type GithubErrorProps = {
  error: Error;
  what: string;
  onRetry: () => void;
};

/** Explains GitHub failures (rate limit, private repository, bad token) with a retry. */
const GithubError = ({ error, what, onRetry }: GithubErrorProps) => {
  const code = error instanceof ApiError ? error.data.code : undefined;
  const resetAt = error instanceof ApiError ? (error.data.resetAt as string | null | undefined) : null;
  const retry = (
    <Button size="sm" onClick={onRetry}>
      Reintentar
    </Button>
  );

  if (code === "rate_limited") {
    return (
      <Alert tone="warn" action={retry}>
        Se agotaron las consultas a GitHub{resetAt ? `; se renuevan ${relativeTime(resetAt)}` : ""}. Conecta tu cuenta para
        tener 5000 por hora.
      </Alert>
    );
  }
  if (code === "not_found") {
    return (
      <Alert tone="warn" action={retry}>
        GitHub no encontró el repositorio. Revisa la URL o, si es privado, conecta una cuenta con acceso.
      </Alert>
    );
  }
  if (code === "unauthorized") {
    return <Alert action={retry}>GitHub rechazó el token. Vuelve a ejecutar gh auth login o renueva GITHUB_TOKEN.</Alert>;
  }
  return <Alert action={retry}>No se pudieron cargar {what}.</Alert>;
};

export default GithubError;
