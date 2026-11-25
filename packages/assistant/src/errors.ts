/** A failure the API layer reports as "the assistant could not answer", never with details. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "refusal" | "truncated" | "api",
  ) {
    super(message);
  }
}
