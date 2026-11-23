export type GithubErrorCode = "not_found" | "rate_limited" | "unauthorized" | "upstream";

/** Errors with a stable code so callers can map them to HTTP statuses and UI messages. */
export class GithubError extends Error {
  constructor(
    readonly code: GithubErrorCode,
    message: string,
    readonly resetAt: string | null = null,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

type RequestErrorLike = { status?: number; response?: { headers?: Record<string, string | undefined> } };

export const toGithubError = (e: unknown): GithubError => {
  if (e instanceof GithubError) return e;
  const { status, response } = (e ?? {}) as RequestErrorLike;
  const headers = response?.headers ?? {};
  const reset = headers["x-ratelimit-reset"];
  const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : null;
  if (status === 429 || (status === 403 && headers["x-ratelimit-remaining"] === "0")) {
    return new GithubError("rate_limited", "Se agotó el límite de consultas a GitHub", resetAt);
  }
  if (status === 401) return new GithubError("unauthorized", "El token de GitHub no es válido o expiró");
  if (status === 404) return new GithubError("not_found", "No se encontró en GitHub (o es privado y no hay acceso)");
  if (status === 403) return new GithubError("unauthorized", "GitHub rechazó la consulta por falta de permisos");
  return new GithubError("upstream", "GitHub no respondió como se esperaba");
};
