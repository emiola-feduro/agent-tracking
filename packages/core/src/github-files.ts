/**
 * Starter files for a project's `.github` folder: a CI pipeline (GitHub Actions) built from the
 * chosen stack and a pull request template tied to the project's requirements and Definition of Done.
 */
export type GithubFileKind = "ci" | "prTemplate";
export type GithubFile = { kind: GithubFileKind; path: string; content: string };
export type GithubFilesInput = { name: string; stack: string[]; requirements?: { title: string }[] };

export const GITHUB_FILE_PATHS: Record<GithubFileKind, string> = {
  ci: ".github/workflows/ci.yml",
  prTemplate: ".github/pull_request_template.md",
};

type Toolchain = { label: string; setup: string[]; steps: string[] };

const has = (stack: string[], ...names: string[]) => names.some((n) => stack.includes(n));

/** The first matching toolchain wins: Bun before Node, frameworks before plain languages. */
function toolchain(stack: string[]): Toolchain | null {
  if (has(stack, "Bun", "Bun test")) {
    return {
      label: "Bun",
      setup: ["- uses: oven-sh/setup-bun@v2"],
      steps: ["- run: bun install", "- run: bun test", ...(has(stack, "TypeScript") ? ["- run: bunx tsc --noEmit"] : [])],
    };
  }
  if (has(stack, "Deno")) {
    return { label: "Deno", setup: ["- uses: denoland/setup-deno@v2"], steps: ["- run: deno lint", "- run: deno test -A"] };
  }
  if (has(stack, "Flutter", "Dart")) {
    return {
      label: "Flutter",
      setup: ["- uses: subosito/flutter-action@v2", "  with:", "    channel: stable"],
      steps: ["- run: flutter pub get", "- run: flutter analyze", "- run: flutter test"],
    };
  }
  if (has(stack, "FastAPI", "Django", "Python", "Pytest", "SQLAlchemy")) {
    return {
      label: "Python",
      setup: ["- uses: actions/setup-python@v5", "  with:", '    python-version: "3.12"'],
      steps: ["- run: pip install -r requirements.txt", "- run: pytest"],
    };
  }
  if (has(stack, "Go", "Gin")) {
    return { label: "Go", setup: ["- uses: actions/setup-go@v5", "  with:", "    go-version: stable"], steps: ["- run: go vet ./...", "- run: go test ./..."] };
  }
  if (has(stack, "Rust", "Tauri") && !has(stack, "Node.js", "React", "Next.js", "SvelteKit", "Vue", "Angular", "Astro")) {
    return { label: "Rust", setup: ["- uses: dtolnay/rust-toolchain@stable"], steps: ["- run: cargo test"] };
  }
  if (has(stack, "ASP.NET Core", ".NET MAUI", "C#", "Entity Framework")) {
    return { label: ".NET", setup: ["- uses: actions/setup-dotnet@v4", "  with:", "    dotnet-version: 8.0.x"], steps: ["- run: dotnet test"] };
  }
  if (has(stack, "Spring Boot", "Java", "Kotlin", "Hibernate", "Jetpack Compose")) {
    return {
      label: "Java",
      setup: ["- uses: actions/setup-java@v4", "  with:", "    distribution: temurin", '    java-version: "21"'],
      steps: ["- run: ./gradlew test"],
    };
  }
  if (has(stack, "Node.js", "React", "Next.js", "SvelteKit", "Vue", "Angular", "Astro", "Express", "Fastify", "NestJS", "Hono", "Electron", "React Native", "Expo", "TypeScript", "Vitest", "Jest")) {
    return {
      label: "Node.js",
      setup: ["- uses: actions/setup-node@v4", "  with:", "    node-version: 22", "    cache: npm"],
      steps: ["- run: npm ci", "- run: npm test --if-present", "- run: npm run build --if-present"],
    };
  }
  return null;
}

const indent = (lines: string[], spaces: number) => lines.map((l) => " ".repeat(spaces) + l).join("\n");

export function ciWorkflow({ stack }: GithubFilesInput): string {
  const tc = toolchain(stack);
  const steps = tc
    ? [...tc.setup, ...tc.steps]
    : ["# Agrega aquí la instalación, los tests y el build de tu stack.", '- run: echo "Sin pasos configurados todavía"'];
  return `# Generado por Agent Tracking${tc ? ` para ${tc.label}` : ""}. Ajústalo a tu proyecto.
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${indent(steps, 6)}
`;
}

export function pullRequestTemplate({ requirements = [] }: GithubFilesInput): string {
  const list = requirements.map((r) => r.title.trim()).filter(Boolean);
  const hint = list.length
    ? `<!-- Requerimientos del proyecto:\n${list.map((t) => `- ${t}`).join("\n")}\n-->\n`
    : "";
  return `## Qué cambia

<!-- Resume el cambio en una o dos frases. -->

## Requerimiento

${hint}<!-- Indica el requerimiento al que contribuye este cambio. -->

## Definition of Done

- [ ] Se cumplen los criterios del Definition of Done del requerimiento
- [ ] Hay tests nuevos o actualizados y pasan
- [ ] El agente envió su reporte a Agent Tracking

## Cómo probarlo

<!-- Pasos para comprobar el cambio. -->
`;
}

export function githubFiles(input: GithubFilesInput, kinds: GithubFileKind[]): GithubFile[] {
  return kinds.map((kind) => ({
    kind,
    path: GITHUB_FILE_PATHS[kind],
    content: kind === "ci" ? ciWorkflow(input) : pullRequestTemplate(input),
  }));
}
