import Anthropic from "@anthropic-ai/sdk";
import type { AssistantConfig } from "./client";

export type MockRequest = {
  model: string;
  system: string;
  prompt: string;
  /** Top-level property names of the requested output schema, e.g. ["criteria"]. */
  schemaKeys: string[];
  body: Record<string, any>;
};

/** What the fake API answers: the text of the reply, or a full override (stop reason, HTTP status). */
export type MockReply = string | { text?: string; stopReason?: string; status?: number };

/**
 * A real Anthropic SDK client whose `fetch` never touches the network: every request is answered
 * by `reply`. Used by the tests and by the mocked browser run.
 */
export function mockAssistant(reply: (req: MockRequest) => MockReply | Promise<MockReply>): AssistantConfig & { calls: MockRequest[] } {
  const calls: MockRequest[] = [];
  const fakeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const content = body.messages?.[0]?.content;
    const req: MockRequest = {
      model: body.model,
      system: typeof body.system === "string" ? body.system : "",
      prompt: typeof content === "string" ? content : "",
      schemaKeys: Object.keys(body.output_config?.format?.schema?.properties ?? {}),
      body,
    };
    calls.push(req);
    const out = await reply(req);
    const r = typeof out === "string" ? { text: out } : out;
    if (r.status && r.status >= 400) {
      return Response.json({ type: "error", error: { type: "api_error", message: "mock failure" } }, { status: r.status });
    }
    return Response.json({
      id: `msg_mock_${calls.length}`,
      type: "message",
      role: "assistant",
      model: body.model,
      content: [{ type: "text", text: r.text ?? "" }],
      stop_reason: r.stopReason ?? "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });
  };
  const client = new Anthropic({ apiKey: "mock-key", fetch: fakeFetch as unknown as typeof fetch, maxRetries: 0 });
  return { client, models: { default: "claude-sonnet-5-5", heavy: "claude-opus-5-5" }, calls };
}
