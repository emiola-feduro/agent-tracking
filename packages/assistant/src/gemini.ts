import { AssistantError } from "./errors";
import { bareSchema, type HttpClient, type JsonRequest } from "./openai";

/**
 * The Gemini API (`models/{model}:generateContent`) with `responseMimeType: application/json` and
 * `responseJsonSchema`, which takes a subset of standard JSON Schema.
 */

/** Strongest reasoning model (aistudio.google.com/docs/models). */
export const GEMINI_HEAVY_MODEL = "gemini-4-carbon";
/** Everyday model, the one Google's own examples use. */
export const GEMINI_DEFAULT_MODEL = "gemini-4-hydrogen";

const THINKING_LEVEL = { low: "LOW", medium: "MEDIUM", high: "HIGH" } as const;

/** finishReason values that mean the model would not answer. */
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);

export const geminiBody = (req: JsonRequest) => ({
  systemInstruction: { parts: [{ text: req.system }] },
  contents: [{ role: "user", parts: [{ text: req.prompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
    responseJsonSchema: bareSchema(req.jsonSchema),
    maxOutputTokens: 16000,
    thinkingConfig: { thinkingLevel: THINKING_LEVEL[req.effort] },
  },
});

/** Sends one request; returns the parsed JSON answer, not yet validated against the zod schema. */
export async function runGemini(http: HttpClient, req: JsonRequest): Promise<unknown> {
  let res: Response;
  try {
    res = await http.fetch(`${http.baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`, {
      method: "POST",
      // The key goes in a header, not the URL, so it never shows up in request logs.
      headers: { "x-goog-api-key": http.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody(req)),
      signal: AbortSignal.timeout(http.timeoutMs),
    });
  } catch {
    throw new AssistantError("Gemini API sin respuesta", "api");
  }
  if (!res.ok) throw new AssistantError(`Gemini API ${res.status}`, "api");
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new AssistantError("Respuesta de Gemini ilegible", "invalid");
  }
  if (body?.promptFeedback?.blockReason) throw new AssistantError("El modelo rechazó la solicitud", "refusal");
  const candidate = body?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (BLOCKED.has(finish)) throw new AssistantError("El modelo rechazó la solicitud", "refusal");
  if (finish === "MAX_TOKENS") throw new AssistantError("Respuesta incompleta", "truncated");
  const parts: any[] = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const text = parts
    .filter((p) => !p?.thought && typeof p?.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) throw new AssistantError("Respuesta sin datos", "invalid");
  try {
    return JSON.parse(text);
  } catch {
    throw new AssistantError("Respuesta con formato inválido", "invalid");
  }
}
