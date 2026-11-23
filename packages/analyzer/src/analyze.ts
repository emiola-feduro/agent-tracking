import { assertRepoRoot, GitError, isAlwaysIgnored, listRepoFiles, resolveRepoPath } from "@agent-tracking/git";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { detectLanguage, getParser } from "./parser";
import { jsImports, jsSymbols, pyImports, pySymbols } from "./symbols";
import { detectTests } from "./tests";
import type { FileAnalysis, TestFramework, TestKind } from "./types";

export const MAX_FILE_BYTES = 1_000_000;

export type AnalyzeOptions = {
  /** Framework assumed for JS test files that use globals (no test-framework import). */
  defaultFramework?: TestFramework;
};

export function contentHash(source: string): string {
  return new Bun.CryptoHasher("sha256").update(source).digest("hex");
}

/**
 * Analyzes source text. `path` is only used for language detection, test-file detection and classification,
 * so it can be virtual. Returns null for unsupported languages.
 */
export async function analyzeSource(path: string, source: string, opts: AnalyzeOptions = {}): Promise<FileAnalysis | null> {
  const language = detectLanguage(path);
  if (!language) return null;
  const parser = await getParser(language);
  const tree = parser.parse(source);
  if (!tree) throw new Error(`No se pudo analizar ${path}`);
  try {
    const root = tree.rootNode;
    const py = language === "python";
    const imports = py ? pyImports(root) : jsImports(root);
    const symbols = py ? pySymbols(root) : jsSymbols(root);
    const { tests, testKind } = detectTests(root, path, language, imports, opts.defaultFramework);
    return { path, language, hash: contentHash(source), symbols, tests, imports, testKind, hasSyntaxErrors: root.hasError };
  } finally {
    tree.delete();
  }
}

// ---------------------------------------------------------------------------------------------
// Framework hint from the nearest package.json (for test files relying on globals)
// ---------------------------------------------------------------------------------------------

async function frameworkFromPackageJson(file: string): Promise<TestFramework | null> {
  try {
    const pkg = (await Bun.file(file).json()) as Record<string, Record<string, string> | undefined>;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if ("vitest" in deps) return "vitest";
    if ("jest" in deps || "ts-jest" in deps || "@jest/globals" in deps) return "jest";
    if ("@types/bun" in deps || "bun-types" in deps) return "bun";
    return null;
  } catch {
    return null;
  }
}

/** Walks up from the file's directory to the repo root and returns the first package.json with a known runner. */
async function frameworkHint(root: string, relPath: string, memo: Map<string, Promise<TestFramework | null>>): Promise<TestFramework> {
  const dirs = relPath.split("/").slice(0, -1);
  for (let i = dirs.length; i >= 0; i--) {
    const dir = dirs.slice(0, i).join("/");
    let hint = memo.get(dir);
    if (!hint) {
      hint = frameworkFromPackageJson(join(root, dir, "package.json"));
      memo.set(dir, hint);
    }
    const fw = await hint;
    if (fw) return fw;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------------------------
// Single file and whole repository
// ---------------------------------------------------------------------------------------------

/** Analyzes one file of a repository. `path` may be absolute or repo-relative and must stay inside `root`. */
export async function analyzeFile(root: string, path: string, cache?: AnalysisCache): Promise<FileAnalysis | null> {
  const repoRoot = await assertRepoRoot(root);
  const { absolute, relative } = await resolveRepoPath(repoRoot, path);
  if (!detectLanguage(relative)) return null;
  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) throw new GitError(`No existe el archivo ${relative}`, "not_found");
  if (info.size > MAX_FILE_BYTES) throw new GitError(`El archivo ${relative} es demasiado grande para analizarlo`, "too_large");
  const source = await Bun.file(absolute).text();
  const fw = await frameworkHint(repoRoot, relative, new Map());
  return (await analyzeCached(relative, source, fw, cache)).result;
}

async function analyzeCached(relative: string, source: string, fw: TestFramework, cache?: AnalysisCache) {
  const hit = cache?.get(relative, contentHash(source), fw);
  if (hit) return { result: hit, cached: true };
  const result = await analyzeSource(relative, source, { defaultFramework: fw });
  if (result && cache) cache.set(relative, fw, result);
  return { result, cached: false };
}

/**
 * Incremental cache keyed by path + content hash (+ framework hint). Serializable with `toJSON()` /
 * `AnalysisCache.fromJSON()` so callers can persist it between runs.
 */
export class AnalysisCache {
  private entries = new Map<string, { fw: TestFramework; analysis: FileAnalysis }>();

  get(path: string, hash: string, fw: TestFramework): FileAnalysis | undefined {
    const e = this.entries.get(path);
    return e && e.analysis.hash === hash && e.fw === fw ? e.analysis : undefined;
  }
  set(path: string, fw: TestFramework, analysis: FileAnalysis) {
    this.entries.set(path, { fw, analysis });
  }
  delete(path: string) {
    this.entries.delete(path);
  }
  /** Drops entries for files no longer present. */
  retain(paths: Iterable<string>) {
    const keep = new Set(paths);
    for (const p of this.entries.keys()) if (!keep.has(p)) this.entries.delete(p);
  }
  get size() {
    return this.entries.size;
  }
  toJSON() {
    return { version: 1, entries: [...this.entries.values()] };
  }
  static fromJSON(data: unknown): AnalysisCache {
    const cache = new AnalysisCache();
    const d = data as { version?: number; entries?: { fw: TestFramework; analysis: FileAnalysis }[] } | null;
    if (d?.version === 1 && Array.isArray(d.entries)) for (const e of d.entries) cache.set(e.analysis.path, e.fw, e.analysis);
    return cache;
  }
}

export type RepoAnalysis = {
  root: string;
  files: FileAnalysis[];
  skipped: { path: string; reason: string }[];
  stats: {
    /** Supported files considered. */
    files: number;
    parsed: number;
    fromCache: number;
    symbols: number;
    tests: number;
    testsByKind: Record<TestKind, number>;
    durationMs: number;
  };
};

export type AnalyzeRepoOptions = {
  cache?: AnalysisCache;
  /** Only analyze these repo-relative paths (e.g. from the watcher); others are left out of the result. */
  only?: string[];
  maxFileBytes?: number;
  concurrency?: number;
};

const SKIP = /(^|\/)(vendor|dist|build|coverage|\.next|\.venv|venv|__pycache__)\/|\.min\.[cm]?js$|\.bundle\.js$/;

/**
 * Analyzes every supported file that git tracks or would track (so `.gitignore` is honored).
 * With a cache, unchanged files (same content hash) are not parsed again.
 */
export async function analyzeRepo(root: string, opts: AnalyzeRepoOptions = {}): Promise<RepoAnalysis> {
  const started = performance.now();
  const repoRoot = await assertRepoRoot(root);
  const maxBytes = opts.maxFileBytes ?? MAX_FILE_BYTES;
  const all = await listRepoFiles(repoRoot);
  const only = opts.only ? new Set(opts.only) : null;
  const candidates = all.filter((p) => detectLanguage(p) && !isAlwaysIgnored(p) && !SKIP.test(p) && (!only || only.has(p)));
  if (opts.cache && !only) opts.cache.retain(candidates);

  const memo = new Map<string, Promise<TestFramework | null>>();
  const files: FileAnalysis[] = [];
  const skipped: RepoAnalysis["skipped"] = [];
  let parsed = 0;
  let fromCache = 0;

  const work = async (rel: string) => {
    const abs = join(repoRoot, rel);
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) return void opts.cache?.delete(rel); // deleted but still in the index, or a symlink to a dir
    if (info.size > maxBytes) return void skipped.push({ path: rel, reason: "demasiado grande" });
    try {
      const source = await Bun.file(abs).text();
      const fw = await frameworkHint(repoRoot, rel, memo);
      const { result, cached } = await analyzeCached(rel, source, fw, opts.cache);
      if (!result) return;
      if (cached) fromCache++;
      else parsed++;
      files.push(result);
    } catch (err) {
      skipped.push({ path: rel, reason: err instanceof Error ? err.message : String(err) });
    }
  };

  const queue = [...candidates];
  const workers = Array.from({ length: Math.max(1, opts.concurrency ?? 16) }, async () => {
    for (let rel = queue.shift(); rel !== undefined; rel = queue.shift()) await work(rel);
  });
  await Promise.all(workers);

  files.sort((a, b) => a.path.localeCompare(b.path));
  const testsByKind: Record<TestKind, number> = { unit: 0, integration: 0, e2e: 0, component: 0 };
  for (const f of files) for (const t of f.tests) testsByKind[t.kind]++;
  return {
    root: repoRoot,
    files,
    skipped: skipped.sort((a, b) => a.path.localeCompare(b.path)),
    stats: {
      files: candidates.length,
      parsed,
      fromCache,
      symbols: files.reduce((n, f) => n + f.symbols.length, 0),
      tests: files.reduce((n, f) => n + f.tests.length, 0),
      testsByKind,
      durationMs: Math.round(performance.now() - started),
    },
  };
}
