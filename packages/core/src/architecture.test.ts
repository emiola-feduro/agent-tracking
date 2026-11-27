import { describe, expect, test } from "bun:test";
import { architectureLayers, architectureMarkdown, recommendArchitecture } from "./architecture";

describe("architecture", () => {
  test("layers follow what the project has", () => {
    expect(architectureLayers(["fullstack"])).toEqual(["frontend", "backend"]);
    expect(architectureLayers(["frontend"])).toEqual(["frontend"]);
    expect(architectureLayers(["api"])).toEqual(["backend"]);
    expect(architectureLayers(["cli"])).toEqual([]);
    expect(architectureLayers(["mobile", "api"])).toEqual(["frontend", "backend"]);
  });

  test("recommendations depend on the kind and the stack", () => {
    expect(recommendArchitecture("frontend", { kinds: ["frontend"], stack: ["React"] }).id).toBe("feature-based");
    expect(recommendArchitecture("frontend", { kinds: ["app"], stack: ["Dart", "Flutter"] }).id).toBe("clean-ui");
    expect(recommendArchitecture("frontend", { kinds: ["mobile"], stack: ["Swift", "SwiftUI"] }).id).toBe("mvvm");
    expect(recommendArchitecture("backend", { kinds: ["api"], stack: ["Hono"] }).id).toBe("layered");
    expect(recommendArchitecture("backend", { kinds: ["api"], stack: ["NestJS"] }).id).toBe("modular-monolith");
    expect(recommendArchitecture("backend", { kinds: ["fullstack"], stack: [] }).id).toBe("modular-monolith");
    expect(recommendArchitecture("backend", { kinds: ["api"], stack: [] }).reason).toContain("API");
  });

  test("the chosen ones become CONTEXT.md guidance", () => {
    const md = architectureMarkdown({ frontend: "feature-based", backend: "hexagonal" });
    expect(md[0]).toStartWith("- **Frontend: Por funcionalidades.**");
    expect(md[1]).toContain("puertos");
    expect(architectureMarkdown({ frontend: null })).toEqual([]);
  });
});
