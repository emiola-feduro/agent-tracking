import { describe, expect, test } from "bun:test";
import { agentContextBlock } from "./agent-context";
import { buildContextMarkdown } from "./context";
import { parseProjectFile, serializeProjectFile, toProjectFile } from "./project-file";
import { replyLanguageRule } from "./reply-language";
import type { ProjectSnapshot } from "./types";

const snap = (replyLanguage: ProjectSnapshot["project"]["replyLanguage"]): ProjectSnapshot =>
  ({
    project: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Gastos",
      goal: "",
      kind: "api",
      platforms: [],
      stack: [],
      databases: [],
      repoPath: null,
      repoUrl: null,
      replyLanguage,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    rules: [],
    skills: [],
    requirements: [],
    dod: [],
    features: [],
    tests: [],
    files: [],
    featureFiles: [],
    symbols: [],
    testIdeas: [],
    attachments: [],
  }) as unknown as ProjectSnapshot;

describe("reply language", () => {
  test("the rule names the language, with its own name when it differs", () => {
    expect(replyLanguageRule("es")).toContain("en español:");
    expect(replyLanguageRule("en")).toContain("en inglés (English):");
    expect(replyLanguageRule("en")).toContain("submit_report");
    expect(replyLanguageRule(null)).toBeNull();
  });

  test("goes into CONTEXT.md and the agents' block only when set", () => {
    expect(buildContextMarkdown(snap("pt"))).toContain("## Idioma con el usuario");
    expect(agentContextBlock(snap("pt"))).toContain("portugués (Português)");
    expect(buildContextMarkdown(snap(null))).not.toContain("## Idioma con el usuario");
    expect(agentContextBlock(snap(null))).not.toContain("Háblale al usuario");
  });

  test("travels in project.json; files from before it get Spanish, an explicit none stays none", () => {
    const file = toProjectFile(snap("fr"));
    expect(file.project.replyLanguage).toBe("fr");
    const none = parseProjectFile(serializeProjectFile(toProjectFile(snap(null))));
    expect(none.ok && none.file.project.replyLanguage).toBeNull();
    const { replyLanguage: _dropped, ...older } = file.project;
    const legacy = parseProjectFile(JSON.stringify({ ...file, project: older }));
    expect(legacy.ok && legacy.file.project.replyLanguage).toBe("es");
  });
});
