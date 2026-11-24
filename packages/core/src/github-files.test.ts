import { describe, expect, test } from "bun:test";
import { ciWorkflow, githubFiles, pullRequestTemplate } from "./github-files";

describe("github files", () => {
  test("the CI pipeline follows the stack", () => {
    const bun = ciWorkflow({ name: "x", stack: ["Bun", "Hono", "TypeScript"] });
    expect(bun).toContain("oven-sh/setup-bun@v2");
    expect(bun).toContain("bun test");
    expect(bun).toContain("bunx tsc --noEmit");
    expect(bun).not.toContain("setup-node");
    expect(ciWorkflow({ name: "x", stack: ["Next.js", "TypeScript"] })).toContain("npm ci");
    expect(ciWorkflow({ name: "x", stack: ["FastAPI"] })).toContain("pytest");
    expect(ciWorkflow({ name: "x", stack: ["Flutter", "Dart"] })).toContain("flutter test");
    expect(ciWorkflow({ name: "x", stack: ["Tauri", "React", "Rust"] })).toContain("setup-node");
    const unknown = ciWorkflow({ name: "x", stack: ["SwiftUI"] });
    expect(unknown).toContain("actions/checkout@v4");
    expect(unknown).toContain("Agrega aquí");
  });

  test("the workflow is valid YAML with the steps under the job", () => {
    const parsed = Bun.YAML.parse(ciWorkflow({ name: "x", stack: ["Python"] })) as any;
    expect(parsed.on.pull_request).toBeNull();
    expect(parsed.jobs.test.steps.map((s: any) => s.uses ?? s.run)).toEqual([
      "actions/checkout@v4",
      "actions/setup-python@v5",
      "pip install -r requirements.txt",
      "pytest",
    ]);
    expect(parsed.jobs.test.steps[1].with["python-version"]).toBe("3.12");
  });

  test("the PR template lists the requirements and the DoD checklist", () => {
    const md = pullRequestTemplate({ name: "x", stack: [], requirements: [{ title: "Registrar gastos" }, { title: " " }] });
    expect(md).toContain("- Registrar gastos");
    expect(md).toContain("- [ ] Se cumplen los criterios del Definition of Done");
    expect(githubFiles({ name: "x", stack: [] }, ["prTemplate", "ci"]).map((f) => f.path)).toEqual([
      ".github/pull_request_template.md",
      ".github/workflows/ci.yml",
    ]);
  });
});
