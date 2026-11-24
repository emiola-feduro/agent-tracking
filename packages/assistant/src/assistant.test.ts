import { recommendStack } from "@agent-tracking/core";
import { describe, expect, test } from "bun:test";
import { assistantConfigFromEnv, AssistantError } from "./client";
import { normalizeCriteria, suggestDod } from "./dod";
import { suggestSkills } from "./skills";
import { consistentStack, normalizeStackAnswer, stackOptionsFor, suggestStack } from "./stack";
import { mockAssistant } from "./testing";

const json = (v: unknown) => JSON.stringify(v);
const webBrief = { platforms: ["web" as const], goal: "Tienda en línea", rules: ["Todo pedido requiere login"] };

describe("configuration", () => {
  test("without ANTHROPIC_API_KEY there is no assistant", () => {
    expect(assistantConfigFromEnv({})).toBeNull();
    expect(assistantConfigFromEnv({ ANTHROPIC_API_KEY: "  " })).toBeNull();
  });

  test("with a key it uses Sonnet by default and Opus for heavy work", () => {
    const config = assistantConfigFromEnv({ ANTHROPIC_API_KEY: "sk-test" })!;
    expect(config.models).toEqual({ default: "claude-sonnet-5-5", heavy: "claude-opus-5-5" });
  });
});

describe("stack suggestion", () => {
  test("keeps only options of the chosen platforms and applies the group rules", () => {
    const options = stackOptionsFor(["web"]);
    // React and Next.js share a group (last wins); Tauri is desktop only; FastAPI brings Python.
    expect(consistentStack(["React", "Next.js", "Tauri", "FastAPI", "Inventado"], options)).toEqual(["Next.js", "Python", "FastAPI"]);
  });

  test("a valid answer is returned through the core rules", async () => {
    const mock = mockAssistant(() =>
      json({
        stack: ["React", "Tailwind CSS", "Bun", "Hono", "Drizzle ORM", "TypeScript", "Vitest", "Playwright"],
        databases: ["PostgreSQL", "Redis"],
        rationale: "Una tienda necesita SSR ligero y caché de sesiones.",
        alternatives: [
          { stack: ["Next.js", "TypeScript"], databases: ["PostgreSQL"], when: "Si el SEO es prioritario" },
          { stack: ["React", "Tailwind CSS", "Bun", "Hono", "Drizzle ORM", "TypeScript", "Vitest", "Playwright"], databases: ["PostgreSQL", "Redis"], when: "Duplicada" },
        ],
      }),
    );
    const result = await suggestStack(mock, webBrief);
    expect(result.source).toBe("assistant");
    expect(result.recommendation.stack).toContain("Hono");
    expect(result.recommendation.databases).toEqual(["PostgreSQL", "Redis"]);
    expect(result.recommendation.alternatives).toHaveLength(1);
    // The request carries the project and the catalog limited to web, on the heavy model.
    const [call] = mock.calls;
    expect(call!.model).toBe("claude-opus-5-5");
    expect(call!.prompt).toContain("<goal>Tienda en línea</goal>");
    expect(call!.prompt).not.toContain("- Tauri");
    expect(call!.schemaKeys).toEqual(["stack", "databases", "rationale", "alternatives"]);
    expect(call!.body.fallbacks).toBe("default");
  });

  test("an option from another platform fails validation and falls back to recommendStack", async () => {
    const mock = mockAssistant(() => json({ stack: ["Tauri"], databases: [], rationale: "x", alternatives: [] }));
    const errors: unknown[] = [];
    const result = await suggestStack(mock, webBrief, (e) => errors.push(e));
    expect(result).toEqual({ source: "default", recommendation: recommendStack(["web"]) });
    expect((errors[0] as AssistantError).reason).toBe("invalid");
  });

  test.each([
    ["text that is not JSON", "Te recomiendo React"],
    ["a missing field", json({ stack: ["React"], databases: [] })],
    ["an empty stack", json({ stack: [], databases: ["PostgreSQL"], rationale: "Vacío", alternatives: [] })],
    ["a blank rationale", json({ stack: ["React"], databases: [], rationale: "  ", alternatives: [] })],
  ])("%s falls back to the deterministic recommendation", async (_, text) => {
    const result = await suggestStack(mockAssistant(() => text), webBrief);
    expect(result.source).toBe("default");
    expect(result.recommendation).toEqual(recommendStack(["web"]));
  });

  test.each([
    ["a refusal", { text: "", stopReason: "refusal" }],
    ["a truncated answer", { text: '{"stack": ["Re', stopReason: "max_tokens" }],
    ["an API error", { status: 500 }],
  ])("%s falls back too", async (_, reply) => {
    const result = await suggestStack(mockAssistant(() => reply), webBrief);
    expect(result.source).toBe("default");
  });

  test("normalizes alternatives and caps them at three", () => {
    const alt = (stack: string[]) => ({ stack, databases: ["MongoDB", "Realm"], when: "Caso" });
    const out = normalizeStackAnswer(
      {
        stack: ["React"],
        databases: [],
        rationale: "Base",
        alternatives: [alt(["Vue"]), alt(["Angular"]), alt([]), alt(["Astro"]), alt(["SvelteKit"])],
      },
      ["web"],
    )!;
    expect(out.alternatives.map((a) => a.stack)).toEqual([["Vue"], ["Angular"], ["Astro"]]);
    // Realm is a mobile database.
    expect(out.alternatives[0]!.databases).toEqual(["MongoDB"]);
  });
});

describe("Definition of Done", () => {
  const request = { project: webBrief, requirement: { title: "Checkout", description: "Pago con tarjeta" }, existing: ["Paga con tarjeta"] };

  test("returns clean criteria without repeating the existing ones", async () => {
    const mock = mockAssistant(() =>
      json({ criteria: ["- Paga con tarjeta.", "Rechaza tarjetas vencidas con un mensaje claro.", "  ", "rechaza tarjetas vencidas con un mensaje claro", "Envía el recibo por email"] }),
    );
    expect(await suggestDod(mock, request)).toEqual(["Rechaza tarjetas vencidas con un mensaje claro", "Envía el recibo por email"]);
    expect(mock.calls[0]!.model).toBe("claude-sonnet-5-5");
    expect(mock.calls[0]!.prompt).toContain("Existing criteria:\n- Paga con tarjeta");
  });

  test("an answer with the wrong shape is rejected", async () => {
    const promise = suggestDod(mockAssistant(() => json({ criteria: "Paga" })), request);
    await expect(promise).rejects.toBeInstanceOf(AssistantError);
  });

  test("an answer with nothing new is rejected", async () => {
    const promise = suggestDod(mockAssistant(() => json({ criteria: ["Paga con tarjeta"] })), request);
    await expect(promise).rejects.toMatchObject({ reason: "invalid" });
  });

  test("caps the list at eight", () => {
    expect(normalizeCriteria(Array.from({ length: 12 }, (_, i) => `Criterio ${i}`))).toHaveLength(8);
  });
});

describe("skills", () => {
  const candidates = [
    { id: "user::tdd", name: "tdd", description: "Test first" },
    { id: "plugin:x:react-conventions", name: "react-conventions", description: "React TSX conventions" },
  ];

  test("returns known ids once, with reasons", async () => {
    const mock = mockAssistant(() =>
      json({ skills: [{ id: "plugin:x:react-conventions", reason: "El proyecto usa React" }, { id: "plugin:x:react-conventions", reason: "Otra vez" }] }),
    );
    expect(await suggestSkills(mock, { ...webBrief, stack: ["React"] }, candidates)).toEqual([
      { id: "plugin:x:react-conventions", reason: "El proyecto usa React" },
    ]);
  });

  test("an unknown id fails validation", async () => {
    const mock = mockAssistant(() => json({ skills: [{ id: "user::inventada", reason: "x" }] }));
    await expect(suggestSkills(mock, webBrief, candidates)).rejects.toBeInstanceOf(AssistantError);
  });

  test("no candidates means no request", async () => {
    const mock = mockAssistant(() => "");
    expect(await suggestSkills(mock, webBrief, [])).toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });
});
