import { AssistantError } from "./errors";

/**
 * The OpenAI Responses API (`POST /v1/responses`) with Structured Outputs: `text.format` of type
 * `json_schema` in strict mode. Only `fetch` is used, so tests pass a fake one.
 */

/** Flagship model for complex reasoning (developers.openai.com/api/docs/models). */
export const OPENAI_HEAVY_MODEL = "gpt-6.2-astra";
/** Balanced model for short, structured answers. */
export const OPENAI_DEFAULT_MODEL = "gpt-6.2-sol";

export type HttpClient = {
  apiKey: string;
  fetch: typeof fetch;
  baseUrl: string;
  timeoutMs: number;
};

export type JsonRequest = {
  model: string;
  effort: "low" | "medium" | "high";
  system: string;
  prompt: string;
  /** JSON Schema of the answer (objects closed and fully required, as zod emits them). */
  jsonSchema: Record<string, unknown>;
};

/** Drops the `$schema` marker, which the providers' schema subsets do not need. */
export const bareSchema = ({ $schema: _, ...schema }: Record<string, unknown>) => schema;

export const openaiBody = (req: JsonRequest) => ({
  model: req.model,
  instructions: req.system,
  input: [{ role: "user", content: req.prompt }],
  reasoning: { effort: req.effort },
  max_output_tokens: 16000,
  store: false,
  text: { format: { type: "json_schema", name: "answer", schema: bareSchema(req.jsonSchema), strict: true } },
});

/** Sends one request; returns the parsed JSON answer, not yet validated against the zod schema. */
export async function runOpenAI(http: HttpClient, req: JsonRequest): Promise<unknown> {
  let res: Response;
  try {
    res = await http.fetch(`${http.baseUrl}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${http.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(openaiBody(req)),
      signal: AbortSignal.timeout(http.timeoutMs),
    });
  } catch {
    throw new AssistantError("OpenAI API sin respuesta", "api");
  }
  if (!res.ok) throw new AssistantError(`OpenAI API ${res.status}`, "api");
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new AssistantError("Respuesta de OpenAI ilegible", "invalid");
  }
  if (body?.status === "incomplete") {
    throw body.incomplete_details?.reason === "content_filter"
      ? new AssistantError("El modelo rechazó la solicitud", "refusal")
      : new AssistantError("Respuesta incompleta", "truncated");
  }
  const content = (Array.isArray(body?.output) ? body.output : [])
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []));
  if (content.some((c: any) => c?.type === "refusal")) throw new AssistantError("El modelo rechazó la solicitud", "refusal");
  const text = content
    .filter((c: any) => c?.type === "output_text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("");
  if (!text) throw new AssistantError("Respuesta sin datos", "invalid");
  try {
    return JSON.parse(text);
  } catch {
    throw new AssistantError("Respuesta con formato inválido", "invalid");
  }
}
