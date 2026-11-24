import type { LanguageId } from "./parser";

export type { LanguageId };

export type SymbolKind = "function" | "class" | "method" | "variable" | "constant" | "type" | "interface" | "enum";

export type CodeSymbol = {
  name: string;
  kind: SymbolKind;
  /** 1-based, inclusive. */
  startLine: number;
  endLine: number;
  /**
   * TS/JS: has `export` (including `export { x }` and `export default`).
   * Python: public name (no leading `_`), or listed in `__all__` when the module defines it.
   * Methods inherit the flag of their class unless they are private.
   */
  exported: boolean;
  /** `export default`. */
  isDefault?: boolean;
  async?: boolean;
  /** Methods only: `private` / `#name` (TS/JS) or a leading underscore (Python); never exported. */
  private?: boolean;
  /** Methods of a class. */
  children?: CodeSymbol[];
};

export type TestFramework = "vitest" | "jest" | "bun" | "playwright" | "pytest" | "unknown";
export type TestKind = "unit" | "integration" | "e2e" | "component";

export type DetectedTest = {
  /** Full name: enclosing describe blocks joined with " > " (JS) or pytest node id `Class::test` (Python). */
  name: string;
  /** Repo-relative POSIX path. */
  file: string;
  /** 1-based. */
  line: number;
  endLine: number;
  framework: TestFramework;
  kind: TestKind;
  /** `.skip`, `.todo`, `xit`, `@pytest.mark.skip`… */
  skipped: boolean;
  /** Parameterized: `test.each`, `@pytest.mark.parametrize`. */
  parameterized: boolean;
};

export type FileAnalysis = {
  /** Repo-relative POSIX path (or the path given to `analyzeSource`). */
  path: string;
  language: LanguageId;
  /** sha256 of the content, hex: key of the incremental cache. */
  hash: string;
  symbols: CodeSymbol[];
  tests: DetectedTest[];
  /** Module specifiers imported (`import`, `require`, dynamic `import()`, Python `import`/`from`). */
  imports: string[];
  /** Test classification for the whole file (null if the file has no tests) and why. */
  testKind: { kind: TestKind; framework: TestFramework; reason: string } | null;
  /** Set when tree-sitter recovered from syntax errors: results may be partial. */
  hasSyntaxErrors: boolean;
};
